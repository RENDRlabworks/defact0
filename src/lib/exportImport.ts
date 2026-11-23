import { blobToDataUrl, dataUrlToBlob, getAssetBlobAny, restoreAsset } from '../engine/assets'
import type { Editor } from '../engine/Editor'
import { renderPng } from '../engine/exportImage'
import type { Doc } from '../engine/types'

export const FILE_FORMAT = 'defact0'

export interface ExportFile {
  format: typeof FILE_FORMAT
  version: 1
  exportedAt: string
  doc: Doc
  /** Image blobs inlined as data URLs, keyed by asset id. */
  assetData: Record<string, string>
}

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

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')

export async function serializeCanvas(editor: Editor): Promise<ExportFile> {
  const doc = editor.doc.get()
  const used = new Set(Object.values(doc.shapes).flatMap((s) => (s.type === 'card' && s.assetId ? [s.assetId] : [])))
  const assetData: Record<string, string> = {}
  for (const id of used) {
    const blob = await getAssetBlobAny(id)
    if (blob) assetData[id] = await blobToDataUrl(blob)
  }
  const assets = Object.fromEntries(Object.entries(doc.assets).filter(([id]) => used.has(id)))
  return { format: FILE_FORMAT, version: 1, exportedAt: new Date().toISOString(), doc: { ...doc, assets }, assetData }
}

/** Export the entire canvas (shapes, sessions, tags and images) as one JSON file. */
export async function exportCanvasJson(editor: Editor) {
  const file = await serializeCanvas(editor)
  download(new Blob([JSON.stringify(file)], { type: 'application/json' }), `defact0-${stamp()}.json`)
}

export function validateExport(data: unknown): data is ExportFile {
  const d = data as ExportFile
  return !!d && d.format === FILE_FORMAT && d.version === 1 && !!d.doc && typeof d.doc.shapes === 'object' && Array.isArray(d.doc.order)
}

export async function importCanvasJson(editor: Editor, file: File): Promise<{ ok: true } | { ok: false; error: string }> {
  let data: unknown
  try {
    data = JSON.parse(await file.text())
  } catch {
    return { ok: false, error: 'not JSON' }
  }
  if (!validateExport(data)) return { ok: false, error: 'not a defact0 export' }
  for (const [id, url] of Object.entries(data.assetData ?? {})) await restoreAsset(id, await dataUrlToBlob(url))
  const doc: Doc = { version: 1, shapes: data.doc.shapes, order: data.doc.order, assets: data.doc.assets ?? {}, sessions: data.doc.sessions ?? [] }
  editor.loadDoc(doc, { keepHistory: true })
  editor.zoomToFit(false)
  return { ok: true }
}

/** Export the selection, or everything visible when nothing is selected, as one PNG. */
export async function exportPng(editor: Editor, mode: 'selection' | 'viewport'): Promise<boolean> {
  let blob: Blob | null
  if (mode === 'selection') {
    blob = await renderPng(editor, editor.getSelectedIds())
  } else {
    const view = editor.getViewportPageBox()
    const ids = editor.getShapes().map((s) => s.id)
    blob = await renderPng(editor, ids, { bounds: view })
  }
  if (!blob) return false
  download(blob, `defact0-${mode}-${stamp()}.png`)
  return true
}
