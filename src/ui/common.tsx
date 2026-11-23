import { useEffect, useRef, type ReactNode } from 'react'
import { useEditor } from '../engine/react'

const stopEventPropagation = (e: { stopPropagation(): void }) => e.stopPropagation()

/** Stop pointer/wheel/key events from reaching the canvas underneath. */
export const shield = {
  onPointerDown: stopEventPropagation,
  onPointerUp: stopEventPropagation,
  onWheel: stopEventPropagation,
  onKeyDown: stopEventPropagation,
  onKeyUp: stopEventPropagation,
  onDoubleClick: stopEventPropagation,
}

/** A modal dialog. Canvas shortcuts are suspended while any modal is open (see isModalOpen). */
export function Modal({
  title,
  onClose,
  children,
  wide,
  footer,
}: {
  title: ReactNode
  onClose(): void
  children: ReactNode
  wide?: boolean
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = ref.current
    const first =
      root?.querySelector<HTMLElement>('.d0-modal__body [data-autofocus]') ??
      root?.querySelector<HTMLElement>('.d0-modal__body input, .d0-modal__body textarea, .d0-modal__body select') ??
      root?.querySelector<HTMLElement>('[data-autofocus], input, textarea')
    first?.focus()
  }, [])
  return (
    <div
      className="d0-modal-backdrop"
      {...shield}
      onPointerDown={(e) => {
        stopEventPropagation(e)
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') onClose()
      }}
    >
      <div ref={ref} className={`d0-modal ${wide ? 'd0-modal--wide' : ''}`} role="dialog" aria-modal="true">
        <div className="d0-modal__header">
          <div className="d0-modal__title">{title}</div>
          <button className="d0-icon-btn" onClick={onClose} title="Close (Esc)" aria-label="Close">
            ×
          </button>
        </div>
        <div className="d0-modal__body">{children}</div>
        {footer && <div className="d0-modal__footer">{footer}</div>}
      </div>
    </div>
  )
}

export function formatDate(ms: number) {
  if (!ms) return ''
  const d = new Date(ms)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' })
}

/** Select shapes and fly the camera to them. */
export function useJumpTo() {
  const editor = useEditor()
  return (ids: string[]) => {
    const existing = ids.filter((id) => editor.getShape(id))
    if (!existing.length) return
    editor.setTool('select')
    editor.select(existing)
    editor.zoomToSelection()
  }
}
