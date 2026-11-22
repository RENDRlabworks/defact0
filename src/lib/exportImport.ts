import {
  parseTldrawJsonFile,
  serializeTldrawJson,
  type Editor,
  type TLShapeId,
} from 'tldraw'

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function stamp() {
  return new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
}

/**
 * Export the entire canvas (all pages, shapes, sessions, and images inlined as data URLs)
 * as a single JSON file. The format is tldraw's .tldr format, which is plain JSON.
 */
export async function exportCanvasJson(editor: Editor) {
  const json = await serializeTldrawJson(editor)
  download(new Blob([json], { type: 'application/json' }), `defact0-${stamp()}.json`)
}

export async function importCanvasJson(editor: Editor, file: File): Promise<{ ok: true } | { ok: false; error: string }> {
  const text = await file.text()
  const result = parseTldrawJsonFile({ json: text, schema: editor.store.schema })
  if (!result.ok) return { ok: false, error: result.error.type }
  const snapshot = result.value.getStoreSnapshot()
  editor.loadSnapshot(snapshot)
  editor.zoomToFit()
  return { ok: true }
}

/**
 * Export the selection (or, with nothing selected, everything visible in the viewport)
 * as one PNG.
 */
export async function exportPng(editor: Editor, mode: 'selection' | 'viewport') {
  let ids: TLShapeId[]
  let bounds
  if (mode === 'selection') {
    ids = editor.getSelectedShapeIds()
  } else {
    bounds = editor.getViewportPageBounds()
    ids = editor
      .getCurrentPageShapes()
      .filter((s) => {
        const b = editor.getShapePageBounds(s.id)
        return b && bounds!.collides(b)
      })
      .map((s) => s.id)
  }
  if (!ids.length) return false
  const { blob } = await editor.toImage(ids, {
    format: 'png',
    scale: 2,
    background: true,
    padding: mode === 'viewport' ? 0 : 32,
    bounds,
  })
  download(blob, `defact0-${mode}-${stamp()}.png`)
  return true
}
