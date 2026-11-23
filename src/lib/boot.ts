import type { Editor } from '../engine/Editor'
import { listAssetIds, deleteAssetBlob, loadDoc, saveDoc } from '../engine/persistence'
import type { Camera, Doc } from '../engine/types'
import { toast } from './uiState'

const CAMERA_KEY = 'defact0:camera'

export function readCamera(): Camera | undefined {
  try {
    const c = JSON.parse(localStorage.getItem(CAMERA_KEY) ?? 'null')
    return c && typeof c.z === 'number' ? c : undefined
  } catch {
    return undefined
  }
}

/** Load the saved canvas, then keep saving it (debounced) as it changes. */
export async function startPersistence(editor: Editor): Promise<() => void> {
  let saved: Doc | undefined
  try {
    saved = await loadDoc()
  } catch (err) {
    console.error(err)
    toast({ title: 'Storage unavailable', description: 'Your browser blocked IndexedDB, so changes will not be saved.', kind: 'error' }, 0)
  }
  if (saved?.version === 1) {
    editor.loadDoc(saved)
    void collectGarbage(saved)
  }
  if (!readCamera()) editor.zoomToFit(false)

  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: Doc | null = null
  const flush = () => {
    if (!pending) return
    const doc = pending
    pending = null
    saveDoc(doc).catch((err) => {
      console.error(err)
      toast({ title: 'Could not save', description: String(err), kind: 'error' })
    })
  }
  const unsubDoc = editor.doc.subscribe(() => {
    pending = editor.doc.get()
    clearTimeout(timer)
    timer = setTimeout(flush, 300)
  })
  let camTimer: ReturnType<typeof setTimeout> | undefined
  const unsubUi = editor.ui.subscribe(() => {
    clearTimeout(camTimer)
    camTimer = setTimeout(() => {
      try {
        localStorage.setItem(CAMERA_KEY, JSON.stringify(editor.getCamera()))
      } catch {
        /* ignore */
      }
    }, 400)
  })
  const onHide = () => flush()
  window.addEventListener('pagehide', onHide)
  document.addEventListener('visibilitychange', onHide)
  return () => {
    flush()
    unsubDoc()
    unsubUi()
    window.removeEventListener('pagehide', onHide)
    document.removeEventListener('visibilitychange', onHide)
  }
}

/** Remove image blobs no shape references any more (keeps storage from growing forever). */
async function collectGarbage(doc: Doc) {
  try {
    const used = new Set(Object.values(doc.shapes).flatMap((s) => (s.type === 'card' && s.assetId ? [s.assetId] : [])))
    for (const id of await listAssetIds()) if (!used.has(String(id))) await deleteAssetBlob(String(id))
  } catch {
    /* best effort */
  }
}
