import {
  defaultHandleExternalFileContent,
  Vec,
  type Editor,
  type TLDefaultExternalContentHandlerOpts,
  type TLShapeId,
  type VecLike,
} from 'tldraw'
import { arrangeBySimilarity, arrangeGrid } from './arrangeActions'
import { createTextCard, pageBoundsOf } from './canvas'
import { detectCode, isTextLikeFile, languageFromFilename, stripFence, titleFromText } from './detect'

type Opts = TLDefaultExternalContentHandlerOpts

function dropPoint(editor: Editor, point?: VecLike) {
  return point ? Vec.From(point) : editor.getViewportPageBounds().center
}

/** Offer to tidy up after several items land at once. */
export function offerArrange(editor: Editor, ids: TLShapeId[], toasts: Opts['toasts']) {
  if (ids.length < 2) return
  toasts.addToast({
    title: `Dropped ${ids.length} items`,
    description: 'Tidy them up?',
    keepOpen: false,
    actions: [
      { type: 'primary', label: 'Grid', onClick: () => arrangeGrid(editor, ids) },
      { type: 'normal', label: 'By similarity', onClick: () => void arrangeBySimilarity(editor, ids) },
    ],
  })
}

async function cardsFromTextFiles(editor: Editor, files: File[], start: Vec): Promise<TLShapeId[]> {
  const ids: TLShapeId[] = []
  let x = start.x
  for (const file of files) {
    const raw = await file.text()
    const lang = languageFromFilename(file.name)
    const detected = detectCode(raw)
    const isCode = lang ? lang !== '' && lang !== 'markdown' && lang !== 'log' : detected.isCode
    const id = createTextCard(editor, { x, y: start.y }, {
      title: file.name,
      text: raw.length > 20000 ? raw.slice(0, 20000) + '\n… (truncated)' : raw,
      isCode,
      language: lang || detected.language,
    })
    const b = editor.getShapePageBounds(id)
    x += (b?.w ?? 320) + 32
    ids.push(id)
  }
  return ids
}

export function registerContentHandlers(editor: Editor, opts: Opts) {
  // Files: images go through tldraw's pipeline (which our CardShapeUtil turns into cards);
  // text/code files become snippet cards. Multi-drops get an "arrange?" prompt.
  editor.registerExternalContentHandler('files', async ({ point, files }) => {
    // Check the extension first: browsers report .ts files as "video/mp2t".
    const textFiles = files.filter((f) => !f.type.startsWith('image/') && isTextLikeFile(f))
    const mediaFiles = files.filter((f) => !textFiles.includes(f))
    const before = new Set(editor.getCurrentPageShapeIds())
    const p = dropPoint(editor, point)

    if (mediaFiles.length) await defaultHandleExternalFileContent(editor, { point: p, files: mediaFiles }, opts)

    if (textFiles.length) {
      const mediaBounds = pageBoundsOf(editor, [...editor.getCurrentPageShapeIds()].filter((id) => !before.has(id)))
      const start = mediaBounds ? new Vec(mediaBounds.maxX + 200, p.y) : p
      editor.markHistoryStoppingPoint('drop text files')
      await cardsFromTextFiles(editor, textFiles, start)
    }

    const created = [...editor.getCurrentPageShapeIds()].filter((id) => !before.has(id))
    if (created.length) editor.select(...created)
    offerArrange(editor, created, opts.toasts)
  })

  // Plain text paste/drop: make a snippet card instead of a bare text shape.
  editor.registerExternalContentHandler('text', async ({ point, text }) => {
    const p = dropPoint(editor, point)
    const body = stripFence(text.replace(/\r\n/g, '\n')).replace(/\s+$/, '')
    if (!body.trim()) return
    const { isCode, language } = detectCode(text)
    editor.markHistoryStoppingPoint('paste text card')
    const id = createTextCard(editor, p, { title: titleFromText(body), text: body, isCode, language })
    editor.select(id)
  })
}
