import { addImageAsset } from '../engine/assets'
import { uid, type Editor } from '../engine/Editor'
import type { AssetMeta, Shape, Vec } from '../engine/types'
import { arrangeBySimilarity, arrangeGrid } from './arrangeActions'
import { createImageCard, createTextCard } from './canvas'
import { detectCode, isTextLikeFile, languageFromFilename, stripFence, titleFromText } from './detect'
import { toast } from './uiState'

const MIME = 'application/x-defact0+json'

/** Offer to tidy up after several items land at once. */
export function offerArrange(editor: Editor, ids: string[]) {
  if (ids.length < 2) return
  toast(
    {
      title: `Added ${ids.length} items`,
      description: 'Tidy them up?',
      actions: [
        { label: 'Grid', primary: true, run: () => arrangeGrid(editor, ids) },
        { label: 'By similarity', run: () => void arrangeBySimilarity(editor, ids) },
      ],
    },
    10000
  )
}

/** Add dropped/pasted files: images become image cards, code and text files become snippet cards. */
export async function addFiles(editor: Editor, files: File[], at?: Vec): Promise<string[]> {
  const point = at ?? editor.getViewportCenter()
  const images = files.filter((f) => f.type.startsWith('image/'))
  const texts = files.filter((f) => !f.type.startsWith('image/') && isTextLikeFile(f))
  const skipped = files.length - images.length - texts.length
  if (skipped) toast({ title: `Skipped ${skipped} unsupported file${skipped > 1 ? 's' : ''}`, kind: 'error' })

  const assets: AssetMeta[] = []
  for (const f of images) {
    try {
      assets.push(await addImageAsset(editor, f, f.name || 'Screenshot'))
    } catch (err) {
      console.error(err)
      toast({ title: `Couldn't read ${f.name}`, kind: 'error' })
    }
  }
  const textData = await Promise.all(texts.map(async (f) => ({ f, raw: await f.text() })))

  const ids = editor.run(() => {
    const out: string[] = []
    let x = point.x
    for (const a of assets) {
      const id = createImageCard(editor, a, { x, y: point.y })
      x += editor.getShape(id)!.w + 32
      out.push(id)
    }
    for (const { f, raw } of textData) {
      const lang = languageFromFilename(f.name)
      const detected = detectCode(raw)
      const isCode = lang ? lang !== 'markdown' && lang !== 'log' && lang !== '' : detected.isCode
      const id = createTextCard(editor, { x, y: point.y }, {
        title: f.name,
        text: raw.length > 20000 ? raw.slice(0, 20000) + '\n… (truncated)' : raw,
        isCode,
        language: lang || detected.language,
      })
      const s = editor.getShape(id)!
      editor.updateShape({ id, x, y: point.y })
      x += s.w + 32
      out.push(id)
    }
    // Center the batch on the drop point.
    const b = editor.getBoundsOf(out)
    if (b) editor.translate(out, { x: point.x - (b.x + b.w / 2), y: point.y - (b.y + b.h / 2) })
    editor.reparent(out)
    return out
  })
  if (ids.length) {
    editor.select(ids)
    const b = editor.getBoundsOf(ids)
    const view = editor.getViewportPageBox()
    if (b && (b.x < view.x || b.y < view.y || b.x + b.w > view.x + view.w || b.y + b.h > view.y + view.h)) editor.zoomToSelection()
  }
  offerArrange(editor, ids)
  return ids
}

export function addText(editor: Editor, text: string, at?: Vec): string | null {
  const body = stripFence(text.replace(/\r\n/g, '\n')).replace(/\s+$/, '')
  if (!body.trim()) return null
  const { isCode, language } = detectCode(text)
  const id = createTextCard(editor, at ?? editor.getViewportCenter(), { title: titleFromText(body), text: body, isCode, language })
  editor.select([id])
  return id
}

/** Serialize the selection for copy/cut. */
export function selectionToClipboard(editor: Editor, data: DataTransfer): boolean {
  const ids = editor.withChildren(editor.getSelectedIds())
  if (!ids.length) return false
  const shapes = editor.getShapes().filter((s) => ids.includes(s.id))
  data.setData(MIME, JSON.stringify({ shapes }))
  // Something readable for other apps.
  data.setData(
    'text/plain',
    shapes
      .map((s) => (s.type === 'card' ? [s.title, s.text].filter(Boolean).join('\n') : s.type === 'note' ? s.text : s.type === 'frame' ? s.name : ''))
      .filter(Boolean)
      .join('\n\n')
  )
  return true
}

function pasteShapes(editor: Editor, json: string, at: Vec) {
  let shapes: Shape[]
  try {
    shapes = JSON.parse(json).shapes
  } catch {
    return false
  }
  if (!Array.isArray(shapes) || !shapes.length) return false
  // Drop references to images we don't have (pasting from another browser).
  const assets = editor.doc.get().assets
  shapes = shapes.map((s) => (s.type === 'card' && s.assetId && !assets[s.assetId] ? { ...s, assetId: null } : s))
  // Fresh ids; keep frame membership only within the pasted set.
  const map = new Map(shapes.map((sh) => [sh.id, uid(sh.type)]))
  const ids = editor.run(() => {
    const created = editor.createShapes(
      shapes.map((sh) => ({ ...sh, id: map.get(sh.id)!, parentId: sh.parentId && map.has(sh.parentId) ? map.get(sh.parentId)! : null, createdAt: Date.now() }))
    )
    const b = editor.getBoundsOf(created)!
    editor.translate(created, { x: at.x - (b.x + b.w / 2), y: at.y - (b.y + b.h / 2) })
    editor.reparent(created.filter((id) => !editor.getShape(id)?.parentId))
    return created
  })
  editor.select(ids.filter((id) => {
    const parent = editor.getShape(id)?.parentId
    return !parent || !ids.includes(parent)
  }))
  return true
}

/** Wire clipboard events to the editor. Inputs keep native behavior. */
export function attachClipboard(editor: Editor, opts: { getPointer(): Vec | null; isBlocked(): boolean }) {
  const inInput = (e: Event) => {
    const t = e.target as HTMLElement | null
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
  }
  const onCopy = (e: ClipboardEvent) => {
    if (inInput(e) || opts.isBlocked() || !e.clipboardData) return
    if (selectionToClipboard(editor, e.clipboardData)) e.preventDefault()
  }
  const onCut = (e: ClipboardEvent) => {
    if (inInput(e) || opts.isBlocked() || !e.clipboardData) return
    if (selectionToClipboard(editor, e.clipboardData)) {
      e.preventDefault()
      editor.deleteShapes(editor.getSelectedIds())
    }
  }
  const onPaste = (e: ClipboardEvent) => {
    if (inInput(e) || opts.isBlocked() || !e.clipboardData) return
    const at = opts.getPointer() ?? editor.getViewportCenter()
    const data = e.clipboardData
    const json = data.getData(MIME)
    if (json && pasteShapes(editor, json, at)) return e.preventDefault()
    const files = [...data.files]
    if (files.length) {
      e.preventDefault()
      void addFiles(editor, files, at)
      return
    }
    const text = data.getData('text/plain')
    if (text) {
      e.preventDefault()
      addText(editor, text, at)
    }
  }
  window.addEventListener('copy', onCopy)
  window.addEventListener('cut', onCut)
  window.addEventListener('paste', onPaste)
  return () => {
    window.removeEventListener('copy', onCopy)
    window.removeEventListener('cut', onCut)
    window.removeEventListener('paste', onPaste)
  }
}
