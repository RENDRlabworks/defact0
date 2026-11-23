import { useEffect, useState } from 'react'
import type { Editor } from './Editor'
import { uid } from './Editor'
import { getAssetBlob, putAssetBlob } from './persistence'
import type { AssetMeta } from './types'

/** Object URLs for asset blobs, created lazily and cached for the session. */
const urlCache = new Map<string, Promise<string | null>>()
/** Blobs added this session, so they render before the IndexedDB write lands. */
const memory = new Map<string, Blob>()

export function getAssetUrl(id: string): Promise<string | null> {
  let p = urlCache.get(id)
  if (!p) {
    p = (async () => {
      const blob = memory.get(id) ?? (await getAssetBlob(id).catch(() => undefined))
      return blob ? URL.createObjectURL(blob) : null
    })()
    urlCache.set(id, p)
  }
  return p
}

export async function getAssetBlobAny(id: string): Promise<Blob | undefined> {
  return memory.get(id) ?? (await getAssetBlob(id).catch(() => undefined))
}

export function useAssetUrl(id: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setUrl(null)
    if (id) void getAssetUrl(id).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [id])
  return url
}

async function imageSize(blob: Blob): Promise<{ w: number; h: number }> {
  try {
    const bmp = await createImageBitmap(blob)
    const size = { w: bmp.width, h: bmp.height }
    bmp.close()
    return size
  } catch {
    // SVGs and some formats: fall back to an <img>.
    const url = URL.createObjectURL(blob)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return { w: img.naturalWidth || 800, h: img.naturalHeight || 600 }
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

/** Store an image blob and register its metadata in the doc. */
export async function addImageAsset(editor: Editor, blob: Blob, name: string): Promise<AssetMeta> {
  const id = uid('asset')
  const { w, h } = await imageSize(blob)
  memory.set(id, blob)
  await putAssetBlob(id, blob)
  const meta: AssetMeta = { id, name, mime: blob.type || 'image/png', w, h, size: blob.size, createdAt: Date.now() }
  editor.addAsset(meta)
  return meta
}

/** Put a blob back under a known id (import). */
export async function restoreAsset(id: string, blob: Blob) {
  memory.set(id, blob)
  urlCache.delete(id)
  await putAssetBlob(id, blob)
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

export async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob()
}
