/** The defact0 document model. Plain JSON, so it persists and exports as-is. */

export type ShapeType = 'card' | 'note' | 'frame' | 'draw'

export type InkColor = 'default' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'violet' | 'grey'
export type NoteColor = 'yellow' | 'orange' | 'pink' | 'green' | 'blue' | 'violet' | 'grey'

interface ShapeBase {
  id: string
  type: ShapeType
  /** Top-left of the unrotated box, in page space. */
  x: number
  y: number
  w: number
  h: number
  /** Radians, around the box center. */
  rotation: number
  /** Frame this shape belongs to. Positions stay in page space; moving a frame moves its children. */
  parentId: string | null
  createdAt: number
  tags: string[]
  /** Claude Code chat session id, '' for none. */
  sessionId: string
}

export interface CardShape extends ShapeBase {
  type: 'card'
  assetId: string | null
  title: string
  text: string
  isCode: boolean
  language: string
}

export interface NoteShape extends ShapeBase {
  type: 'note'
  text: string
  color: NoteColor
}

export interface FrameShape extends ShapeBase {
  type: 'frame'
  name: string
}

export interface DrawShape extends ShapeBase {
  type: 'draw'
  /** Flat [x, y, pressure, x, y, pressure, ...] in the shape's local box space. */
  points: number[]
  color: InkColor
  size: number
}

export type Shape = CardShape | NoteShape | FrameShape | DrawShape
export type ShapeOf<T extends ShapeType> = Extract<Shape, { type: T }>

/** A partial update. `id` is required, everything else optional. */
export type ShapePatch = { id: string } & (
  | Partial<Omit<CardShape, 'id' | 'type'>>
  | Partial<Omit<NoteShape, 'id' | 'type'>>
  | Partial<Omit<FrameShape, 'id' | 'type'>>
  | Partial<Omit<DrawShape, 'id' | 'type'>>
)

export interface AssetMeta {
  id: string
  name: string
  mime: string
  w: number
  h: number
  size: number
  createdAt: number
}

export interface ChatSession {
  id: string
  name: string
  /** Link back to the conversation, e.g. https://claude.ai/code/session_... */
  url: string
  createdAt: number
  notes: string
}

export interface Doc {
  version: 1
  shapes: Record<string, Shape>
  /** z-order, back to front. Frames always render beneath everything else. */
  order: string[]
  assets: Record<string, AssetMeta>
  sessions: ChatSession[]
}

/** screen = (page + {x, y}) * z */
export interface Camera {
  x: number
  y: number
  z: number
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface Vec {
  x: number
  y: number
}

export type Tool = 'select' | 'hand' | 'draw' | 'note' | 'frame'

export type Theme = 'dark' | 'light'

export function emptyDoc(): Doc {
  return { version: 1, shapes: {}, order: [], assets: {}, sessions: [] }
}
