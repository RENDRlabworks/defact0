import { useEffect } from 'react'
import { useActions, useEditor, useToasts, useTranslation, useValue } from 'tldraw'
import { isCard } from '../lib/canvas'
import { registerContentHandlers } from '../lib/content'
import { togglePanel, ui } from '../lib/uiState'
import { Dialogs } from './Dialogs'
import { Icon } from './icons'
import { PreviewModal } from './PreviewModal'
import { SidePanel } from './SidePanel'

/** Everything defact0 adds on top of tldraw. Rendered as a child of <Tldraw>. */
export function Defact0Ui() {
  const editor = useEditor()
  const toasts = useToasts()
  const msg = useTranslation()

  // Drop / paste handling.
  useEffect(() => {
    registerContentHandlers(editor, { toasts, msg })
  }, [editor, toasts, msg])

  // Stamp every new shape with a creation time so the date filter works for notes, frames, etc.
  useEffect(() => {
    return editor.sideEffects.registerBeforeCreateHandler('shape', (shape) => {
      if (shape.meta?.createdAt) return shape
      return { ...shape, meta: { ...shape.meta, createdAt: Date.now() } }
    })
  }, [editor])

  // "Editing" a card (double-click / Enter) opens the preview modal instead.
  const editingId = useValue('editing', () => editor.getEditingShapeId(), [editor])
  useEffect(() => {
    if (!editingId) return
    const shape = editor.getShape(editingId)
    if (!isCard(shape)) return
    editor.setEditingShape(null)
    editor.setCurrentTool('select')
    ui.previewId.set(shape.id)
  }, [editor, editingId])

  return (
    <>
      <SidePanel />
      <PreviewModal />
      <Dialogs />
      <EmptyState />
    </>
  )
}

function EmptyState() {
  const editor = useEditor()
  const isEmpty = useValue('empty', () => editor.getCurrentPageShapeIds().size === 0, [editor])
  if (!isEmpty) return null
  return (
    <div className="d0-empty-state" aria-hidden>
      <div className="d0-empty-state__logo">defact0</div>
      <p>Drop screenshots, diagrams or code files anywhere.</p>
      <p className="d0-muted">
        Paste with <kbd>⌘V</kbd> · new snippet <kbd>C</kbd> · sticky note <kbd>N</kbd> · draw <kbd>D</kbd> · search <kbd>⌘K</kbd>
      </p>
    </div>
  )
}

/** Buttons in tldraw's top-right "share panel" slot. */
export function Defact0TopBar() {
  const actions = useActions()
  const editor = useEditor()
  const panel = useValue('panel', () => ui.panel.get(), [])
  const selCount = useValue('sel', () => editor.getSelectedShapeIds().length, [editor])
  const run = (id: string) => actions[id]?.onSelect('toolbar')
  return (
    <div className="d0-topbar">
      <button className={`d0-top-btn ${panel === 'search' ? 'is-active' : ''}`} onClick={() => togglePanel('search')} title="Search (⌘K)">
        {Icon.search}
        <span>Search</span>
      </button>
      <button className={`d0-top-btn ${panel === 'sessions' ? 'is-active' : ''}`} onClick={() => togglePanel('sessions')} title="Chat sessions (Shift+S)">
        {Icon.sessions}
        <span>Sessions</span>
      </button>
      <button className="d0-top-btn" onClick={() => run('d0-tag')} disabled={!selCount} title="Tag selection (Shift+T)">
        {Icon.tag}
      </button>
      <button className="d0-top-btn" onClick={() => run('d0-arrange-grid')} disabled={selCount < 2} title="Arrange selection in a grid (Shift+A)">
        {Icon.grid}
      </button>
      <button className="d0-top-btn" onClick={() => run('d0-organize')} title="AI organize (Shift+I)">
        {Icon.sparkle}
        <span>Organize</span>
      </button>
      <button
        className="d0-top-btn"
        onClick={() => run(selCount ? 'd0-export-png-selection' : 'd0-export-png-viewport')}
        title={selCount ? 'Export selection as PNG (⌘⇧E)' : 'Export viewport as PNG'}
      >
        {Icon.download}
      </button>
    </div>
  )
}
