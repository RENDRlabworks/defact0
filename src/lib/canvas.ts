import { Box as TlBox, createShapeId, type Editor, type TLShape, type TLShapeId } from 'tldraw'
import { CARD_TYPE, type CardShape } from '../shapes/cardTypes'
import { cardSizeForText } from '../shapes/CardShapeUtil'
import type { SearchItem } from './search'
import { normalizeTag } from './search'

export function isCard(shape: TLShape | undefined | null): shape is CardShape {
  return !!shape && shape.type === CARD_TYPE
}

/** Tags live in card props, and in `meta.tags` for every other shape type. */
export function getTags(shape: TLShape): string[] {
  if (isCard(shape)) return shape.props.tags
  const t = shape.meta?.tags
  return Array.isArray(t) ? (t as string[]) : []
}

export function getSessionId(shape: TLShape): string {
  if (isCard(shape)) return shape.props.sessionId
  return typeof shape.meta?.sessionId === 'string' ? (shape.meta.sessionId as string) : ''
}

export function getCreatedAt(shape: TLShape): number {
  if (isCard(shape)) return shape.props.createdAt
  return typeof shape.meta?.createdAt === 'number' ? (shape.meta.createdAt as number) : 0
}

function kindOf(shape: TLShape): SearchItem['kind'] {
  if (isCard(shape)) return 'card'
  if (shape.type === 'note') return 'note'
  if (shape.type === 'text') return 'text'
  if (shape.type === 'frame') return 'frame'
  return 'other'
}

/** Flatten every shape on the current page into search items. */
export function buildIndex(editor: Editor): SearchItem[] {
  const items: SearchItem[] = []
  for (const shape of editor.getCurrentPageShapes()) {
    if (shape.type === 'group' || shape.type === 'draw' || shape.type === 'highlight') continue
    let title = ''
    let text = ''
    if (isCard(shape)) {
      title = shape.props.title
      text = shape.props.text
    } else if (shape.type === 'frame') {
      title = shape.props.name || 'Frame'
    } else {
      text = editor.getShapeUtil(shape).getText(shape) ?? ''
      title = text.split('\n')[0]?.slice(0, 60) ?? ''
    }
    const tags = getTags(shape)
    if (!title && !text && !tags.length && !isCard(shape)) continue
    items.push({
      id: shape.id,
      kind: kindOf(shape),
      title,
      text,
      tags,
      sessionId: getSessionId(shape),
      createdAt: getCreatedAt(shape),
    })
  }
  return items
}

export function setTags(editor: Editor, ids: TLShapeId[], update: (tags: string[]) => string[]) {
  editor.markHistoryStoppingPoint('set tags')
  editor.run(() => {
    for (const id of ids) {
      const shape = editor.getShape(id)
      if (!shape) continue
      const next = [...new Set(update(getTags(shape)).map(normalizeTag).filter(Boolean))]
      if (isCard(shape)) {
        editor.updateShape<CardShape>({ id, type: CARD_TYPE, props: { tags: next } })
      } else {
        editor.updateShape({ id, type: shape.type, meta: { ...shape.meta, tags: next } })
      }
    }
  })
}

export function setSession(editor: Editor, ids: TLShapeId[], sessionId: string) {
  editor.markHistoryStoppingPoint('set session')
  editor.run(() => {
    for (const id of ids) {
      const shape = editor.getShape(id)
      if (!shape) continue
      if (isCard(shape)) editor.updateShape<CardShape>({ id, type: CARD_TYPE, props: { sessionId } })
      else editor.updateShape({ id, type: shape.type, meta: { ...shape.meta, sessionId } })
      // Tag the frame's children too, so jumping to a session finds everything in it.
      if (shape.type === 'frame') setSessionSilently(editor, editor.getSortedChildIdsForParent(id), sessionId)
    }
  })
}

function setSessionSilently(editor: Editor, ids: TLShapeId[], sessionId: string) {
  for (const id of ids) {
    const shape = editor.getShape(id)
    if (isCard(shape)) editor.updateShape<CardShape>({ id, type: CARD_TYPE, props: { sessionId } })
  }
}

/** Shapes that are top-level (or inside frames) and can be arranged. */
export function arrangeableShapes(editor: Editor, ids: TLShapeId[]): TLShape[] {
  return ids
    .map((id) => editor.getShape(id))
    .filter((s): s is TLShape => !!s && s.type !== 'arrow')
}

export function pageBoundsOf(editor: Editor, ids: TLShapeId[]): TlBox | null {
  const boxes = ids.map((id) => editor.getShapePageBounds(id)).filter((b): b is TlBox => !!b)
  return boxes.length ? TlBox.Common(boxes) : null
}

/** Wrap shapes in a new named frame (with padding) and return its id. */
export function frameShapes(editor: Editor, ids: TLShapeId[], name: string, padding = 48): TLShapeId | null {
  const bounds = pageBoundsOf(editor, ids)
  if (!bounds) return null
  const frameId = createShapeId()
  editor.run(() => {
    editor.createShape({
      id: frameId,
      type: 'frame',
      x: bounds.x - padding,
      y: bounds.y - padding - 8,
      props: { w: bounds.w + padding * 2, h: bounds.h + padding * 2 + 8, name },
    })
    editor.reparentShapes(ids, frameId)
    editor.sendToBack([frameId])
  })
  return frameId
}

export interface NewCardInput {
  title?: string
  text?: string
  isCode?: boolean
  language?: string
  tags?: string[]
}

/** Create a text card centered on a page point. */
export function createTextCard(editor: Editor, point: { x: number; y: number }, input: NewCardInput): TLShapeId {
  const id = createShapeId()
  const { w, h } = cardSizeForText(input.text ?? '')
  editor.createShape<CardShape>({
    id,
    type: CARD_TYPE,
    x: point.x - w / 2,
    y: point.y - h / 2,
    props: {
      w,
      h,
      title: input.title ?? '',
      text: input.text ?? '',
      isCode: input.isCode ?? false,
      language: input.language ?? '',
      tags: input.tags ?? [],
      createdAt: Date.now(),
    },
  })
  return id
}

/** Every image asset id used by these shapes (cards and plain image shapes). */
export function imageAssetIdOf(shape: TLShape): string | null {
  if (isCard(shape)) return shape.props.assetId
  if (shape.type === 'image') return shape.props.assetId
  return null
}
