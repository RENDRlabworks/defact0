import type { Editor } from '../engine/Editor'
import { CARD_HEADER_H } from '../engine/render/ShapeViews'
import type { AssetMeta, Shape, Vec } from '../engine/types'
import type { SearchItem } from './search'
import { normalizeTag } from './search'

export const CARD_MAX_W = 520

/** Size a new image card so the image fits inside CARD_MAX_W while keeping its aspect ratio. */
export function cardSizeForImage(imgW: number, imgH: number): { w: number; h: number } {
  const w0 = Math.max(1, imgW)
  const h0 = Math.max(1, imgH)
  const scale = Math.min(1, CARD_MAX_W / w0, 640 / h0)
  const w = Math.max(160, Math.round(w0 * scale))
  return { w, h: Math.round((w / w0) * h0) + CARD_HEADER_H }
}

/** Size a new text-only card based on its line count. */
export function cardSizeForText(text: string): { w: number; h: number } {
  const lines = text.split('\n')
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0)
  const w = Math.min(CARD_MAX_W, Math.max(260, longest * 7.4 + 32))
  const wrapped = lines.reduce((n, l) => n + Math.max(1, Math.ceil((l.length * 7.4) / (w - 24))), 0)
  const h = Math.min(560, Math.max(110, wrapped * 18 + CARD_HEADER_H + 28))
  return { w: Math.round(w), h: Math.round(h) }
}

export interface NewCardInput {
  title?: string
  text?: string
  isCode?: boolean
  language?: string
  tags?: string[]
}

/** Create a text card centered on a page point. */
export function createTextCard(editor: Editor, point: Vec, input: NewCardInput): string {
  const { w, h } = cardSizeForText(input.text ?? '')
  const id = editor.createShape({
    type: 'card',
    x: point.x - w / 2,
    y: point.y - h / 2,
    w,
    h,
    title: input.title ?? '',
    text: input.text ?? '',
    isCode: input.isCode ?? false,
    language: input.language ?? '',
    tags: input.tags ?? [],
  })
  editor.reparent([id])
  return id
}

export function createImageCard(editor: Editor, asset: AssetMeta, topLeft: Vec): string {
  const { w, h } = cardSizeForImage(asset.w, asset.h)
  return editor.createShape({
    type: 'card',
    x: topLeft.x,
    y: topLeft.y,
    w,
    h,
    assetId: asset.id,
    title: asset.name.replace(/\.[a-z0-9]{2,5}$/i, '') || 'Screenshot',
  })
}

export function shapeText(s: Shape): { title: string; text: string } {
  switch (s.type) {
    case 'card':
      return { title: s.title, text: s.text }
    case 'note':
      return { title: s.text.split('\n')[0].slice(0, 60), text: s.text }
    case 'frame':
      return { title: s.name || 'Frame', text: '' }
    case 'draw':
      return { title: 'Drawing', text: '' }
  }
}

/** Flatten every shape into search items. Drawings only show up when tagged. */
export function buildIndex(editor: Editor): SearchItem[] {
  const items: SearchItem[] = []
  for (const s of editor.getShapes()) {
    if (s.type === 'draw' && !s.tags.length) continue
    const { title, text } = shapeText(s)
    if (s.type === 'note' && !text && !s.tags.length) continue
    items.push({ id: s.id, kind: s.type === 'draw' ? 'other' : s.type, title, text, tags: s.tags, sessionId: s.sessionId, createdAt: s.createdAt })
  }
  return items
}

export function setTags(editor: Editor, ids: string[], update: (tags: string[]) => string[]) {
  editor.updateShapes(
    ids
      .map((id) => editor.getShape(id))
      .filter((s): s is Shape => !!s)
      .map((s) => ({ id: s.id, tags: [...new Set(update(s.tags).map(normalizeTag).filter(Boolean))] }))
  )
}

/** Assign shapes (and the contents of any frames among them) to a chat session. */
export function setSession(editor: Editor, ids: string[], sessionId: string) {
  editor.updateShapes(editor.withChildren(ids).map((id) => ({ id, sessionId })))
}
