import type { Doc } from './types'

/** Minimal IndexedDB wrapper: one key/value store for the doc, one for image blobs. */
const DB_NAME = 'defact0'
const DB_VERSION = 1
let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
      if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

async function tx<T>(store: 'kv' | 'assets', mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode)
    const req = fn(t.objectStore(store))
    t.oncomplete = () => resolve(req.result)
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
  })
}

export const loadDoc = () => tx<Doc | undefined>('kv', 'readonly', (s) => s.get('doc'))
export const saveDoc = (doc: Doc) => tx('kv', 'readwrite', (s) => s.put(doc, 'doc'))
export const putAssetBlob = (id: string, blob: Blob) => tx('assets', 'readwrite', (s) => s.put(blob, id))
export const getAssetBlob = (id: string) => tx<Blob | undefined>('assets', 'readonly', (s) => s.get(id))
export const deleteAssetBlob = (id: string) => tx('assets', 'readwrite', (s) => s.delete(id))
export const listAssetIds = () => tx<IDBValidKey[]>('assets', 'readonly', (s) => s.getAllKeys())
