import type { TLShape } from 'tldraw'

/** Props stored on every defact0 card. Everything lives in the tldraw store, so it persists and exports. */
export interface CardShapeProps {
  w: number
  h: number
  /** tldraw asset id of the image, or null for text-only cards. */
  assetId: string | null
  title: string
  /** Text snippet / notes. Rendered as code when `isCode` is true. */
  text: string
  isCode: boolean
  language: string
  tags: string[]
  /** Id of the Claude Code chat session this card belongs to ('' = none). */
  sessionId: string
  createdAt: number
}

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    card: CardShapeProps
  }
}

export type CardShape = TLShape<'card'>

export const CARD_TYPE = 'card' as const

/** Height of the card header strip (title, tags) in page units. */
export const CARD_HEADER_H = 34
export const CARD_MAX_W = 520
export const CARD_MIN_W = 160
