import { memo, useEffect, useRef } from 'react'
import { useAssetUrl } from '../assets'
import { inkVar, noteVar, strokePath } from '../ink'
import { useDoc, useEditor, useUi } from '../react'
import type { CardShape, DrawShape, FrameShape, NoteShape, Shape } from '../types'

export const CARD_HEADER_H = 34

/** Positions any shape in page space. Content never takes pointer events: hit testing is geometric. */
export const ShapeView = memo(function ShapeView({ shape }: { shape: Shape }) {
  return (
    <div
      className={`d0-shape d0-shape--${shape.type}`}
      data-shape-id={shape.id}
      style={{
        width: shape.w,
        height: shape.h,
        transform: `translate(${shape.x}px, ${shape.y}px) rotate(${shape.rotation}rad)`,
      }}
    >
      {shape.type === 'card' && <CardView shape={shape} />}
      {shape.type === 'note' && <NoteView shape={shape} />}
      {shape.type === 'frame' && <FrameView shape={shape} />}
      {shape.type === 'draw' && <DrawView shape={shape} />}
    </div>
  )
})

function CardView({ shape }: { shape: CardShape }) {
  const { assetId, title, text, isCode, tags, sessionId, language } = shape
  const url = useAssetUrl(assetId)
  const session = useDoc((d) => d.sessions.find((s) => s.id === sessionId))
  const hasImage = Boolean(assetId)
  const hasText = text.trim().length > 0
  return (
    <div className={`d0-card ${hasImage ? 'd0-card--image' : ''} ${hasText ? 'd0-card--text' : ''}`}>
      <div className="d0-card__header" style={{ height: CARD_HEADER_H }}>
        {session && <span className="d0-card__session" title={`Session: ${session.name}`} style={{ background: sessionColor(session.id) }} />}
        <span className="d0-card__title">{title || (hasImage ? 'Image' : isCode ? language || 'Snippet' : 'Note')}</span>
        <span className="d0-card__tags">
          {tags.slice(0, 4).map((t) => (
            <span key={t} className="d0-tag">
              {t}
            </span>
          ))}
          {tags.length > 4 && <span className="d0-tag">+{tags.length - 4}</span>}
        </span>
      </div>
      <div className="d0-card__body">
        {hasImage && (
          <div className="d0-card__image">{url ? <img src={url} alt={title} draggable={false} /> : <div className="d0-card__placeholder">Loading…</div>}</div>
        )}
        {hasText && (isCode ? <pre className="d0-card__code">{text}</pre> : <div className="d0-card__text">{text}</div>)}
        {!hasImage && !hasText && <div className="d0-card__placeholder">Double-click to edit</div>}
      </div>
    </div>
  )
}

function NoteView({ shape }: { shape: NoteShape }) {
  const editor = useEditor()
  const editing = useUi((u) => u.editingId === shape.id)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (!editing) return
    editor.beginInteraction()
    const focus = () => {
      const el = ref.current
      if (!el || document.activeElement === el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }
    focus()
    // The pointer events that created the note can steal focus right after mount.
    const raf = requestAnimationFrame(focus)
    return () => {
      cancelAnimationFrame(raf)
      editor.endInteraction()
    }
  }, [editing, editor])
  const fontSize = shape.text.length > 140 ? 14 : shape.text.length > 60 ? 17 : 20
  return (
    <div className="d0-note" style={{ background: noteVar(shape.color) }}>
      {editing ? (
        <textarea
          ref={ref}
          className="d0-note__input"
          style={{ fontSize }}
          value={shape.text}
          placeholder="Type a note…"
          onChange={(e) => editor.updateShape({ id: shape.id, text: e.target.value })}
          onBlur={() => editor.setEditing(null)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) editor.setEditing(null)
          }}
          onPointerDown={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="d0-note__text" style={{ fontSize }}>
          {shape.text}
        </div>
      )}
    </div>
  )
}

function FrameView({ shape }: { shape: FrameShape }) {
  const isDrop = useUi((u) => u.dropTargetId === shape.id)
  return <div className={`d0-frame ${isDrop ? 'is-drop' : ''}`} />
}

function DrawView({ shape }: { shape: DrawShape }) {
  const d = strokePath(shape.points, shape.size)
  return (
    <svg className="d0-draw" width={shape.w} height={shape.h} overflow="visible">
      <path d={d} fill={inkVar(shape.color)} />
    </svg>
  )
}

/** The in-progress stroke, drawn in page space. */
export function LiveStroke() {
  const drawing = useUi((u) => u.drawing, (a, b) => a === b)
  const color = useUi((u) => u.inkColor)
  const size = useUi((u) => u.inkSize)
  if (!drawing || drawing.length < 3) return null
  return (
    <svg className="d0-live-stroke" width={1} height={1} overflow="visible">
      <path d={strokePath(drawing, size)} fill={inkVar(color)} />
    </svg>
  )
}

/** A stable, pleasant color for a session id. */
export function sessionColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return `hsl(${Math.abs(hash) % 360} 70% 62%)`
}
