import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Editor } from '../engine/Editor'
import { INK_COLORS, INK_SIZES, inkVar, NOTE_COLORS, noteVar } from '../engine/ink'
import { useEditor, useUi } from '../engine/react'
import { Minimap } from '../engine/render/Minimap'
import { useStore } from '../engine/store'
import type { DrawShape, NoteShape, Tool } from '../engine/types'
import { app, dismissToast, isModalOpen, togglePanel, useApp } from '../lib/uiState'
import { ACTIONS, actionById, comboFromEvent, formatKbd, runAction, type Action } from './actions'
import { Modal, shield } from './common'
import { Icon } from './icons'

/* ------------------------------- Shortcuts ------------------------------- */

/** Global keyboard shortcuts, resolved through the action registry. */
export function useShortcuts() {
  const editor = useEditor()
  useEffect(() => {
    const byCombo = new Map<string, Action>()
    for (const a of ACTIONS) for (const k of a.kbd ?? []) byCombo.set(k, a)
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (isModalOpen() || e.isComposing) return
      const combo = comboFromEvent(e)
      // Arrow keys nudge the selection.
      const arrows: Record<string, [number, number]> = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }
      const key = e.key.toLowerCase()
      if (key in arrows && editor.getSelectedIds().length && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        editor.translate(editor.getSelectedIds(), { x: arrows[key][0] * step, y: arrows[key][1] * step })
        return
      }
      const action = byCombo.get(combo)
      if (!action) return
      e.preventDefault()
      runAction(editor, action.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editor])
}

/* ------------------------------- Main menu ------------------------------- */

export function MainMenu() {
  const editor = useEditor()
  const open = useApp((s) => s.menuOpen)
  const history = useStore(editor.history, (h) => h)
  const close = () => app.update({ menuOpen: false })
  return (
    <div className="d0-mainbar" {...shield} data-no-canvas>
      <button className={`d0-top-btn ${open ? 'is-active' : ''}`} onClick={() => app.update({ menuOpen: !open })} aria-label="Menu" title="Menu">
        {Icon.menu}
        <span className="d0-brand">defact0</span>
      </button>
      <button className="d0-top-btn" onClick={() => editor.undo()} disabled={!history.canUndo} title={`Undo (${formatKbd('mod+z')})`} aria-label="Undo">
        {Icon.undo}
      </button>
      <button className="d0-top-btn" onClick={() => editor.redo()} disabled={!history.canRedo} title={`Redo (${formatKbd('mod+shift+z')})`} aria-label="Redo">
        {Icon.redo}
      </button>
      {open && (
        <Menu onClose={close} style={{ top: 44, left: 0 }}>
          <MenuItems
            ids={['insert-image', 'new-card', null, 'search', 'sessions', 'organize', null, 'export-json', 'import-json', 'export-png-viewport', 'export-png-selection', null, 'toggle-theme', 'zoom-fit', 'shortcuts']}
            onDone={close}
          />
          <div className="d0-menu__sep" />
          <button
            className="d0-menu__item is-danger"
            onClick={() => {
              close()
              if (window.confirm('Clear the whole canvas? You can undo this.')) editor.deleteShapes(editor.getShapes().map((s) => s.id))
            }}
          >
            Clear canvas
          </button>
        </Menu>
      )}
    </div>
  )
}

function Menu({ children, onClose, style }: { children: ReactNode; onClose(): void; style: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest('.d0-mainbar > button')) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])
  return (
    <div ref={ref} className="d0-menu" style={style} role="menu" data-no-canvas {...shield}>
      {children}
    </div>
  )
}

function MenuItems({ ids, onDone }: { ids: (string | null)[]; onDone(): void }) {
  const editor = useEditor()
  // Re-evaluate enabled state when selection/doc change.
  useUi((u) => u.selectedIds)
  return (
    <>
      {ids.map((id, i) => {
        if (!id) return <div key={'sep' + i} className="d0-menu__sep" />
        const a = actionById[id]
        const enabled = !a.enabled || a.enabled(editor)
        if (!enabled && a.group !== 'File') return null
        return (
          <button
            key={id}
            role="menuitem"
            className="d0-menu__item"
            disabled={!enabled}
            onClick={() => {
              onDone()
              runAction(editor, id)
            }}
          >
            <span>{a.label}</span>
            {a.kbd?.[0] && <kbd>{formatKbd(a.kbd[0])}</kbd>}
          </button>
        )
      })}
    </>
  )
}

/* ------------------------------ Context menu ----------------------------- */

export function ContextMenu() {
  const editor = useEditor()
  const menu = useApp((s) => s.contextMenu)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  useLayoutEffect(() => {
    if (!menu || !ref.current) return setPos(null)
    const r = ref.current.getBoundingClientRect()
    setPos({ x: Math.min(menu.client.x, window.innerWidth - r.width - 8), y: Math.min(menu.client.y, window.innerHeight - r.height - 8) })
  }, [menu])
  if (!menu) return null
  const close = () => app.update({ contextMenu: null })
  const hasSel = editor.getSelectedIds().length > 0
  const ids: (string | null)[] = hasSel
    ? ['preview', 'tag', 'assign-session', null, 'arrange-grid', 'arrange-similar', 'arrange-similar-frames', 'group', 'ungroup', null, 'bring-front', 'send-back', null, 'duplicate', 'export-png-selection', 'delete']
    : ['new-card', 'insert-image', null, 'organize', 'select-all', 'zoom-fit', 'export-png-viewport']
  return (
    <Menu onClose={close} style={{ position: 'fixed', left: pos?.x ?? menu.client.x, top: pos?.y ?? menu.client.y, visibility: pos ? 'visible' : 'hidden' }}>
      <div ref={ref}>
        <MenuItems ids={ids} onDone={close} />
      </div>
    </Menu>
  )
}

/* --------------------------------- Toolbar -------------------------------- */

const TOOLS: { tool: Tool; icon: ReactNode; label: string; key: string }[] = [
  { tool: 'select', icon: Icon.cursor, label: 'Select', key: 'V' },
  { tool: 'hand', icon: Icon.hand, label: 'Hand', key: 'H' },
  { tool: 'draw', icon: Icon.pencil, label: 'Draw', key: 'D' },
  { tool: 'note', icon: Icon.note, label: 'Sticky note', key: 'N' },
  { tool: 'frame', icon: Icon.frame, label: 'Frame', key: 'F' },
]

export function Toolbar() {
  const editor = useEditor()
  const tool = useUi((u) => u.tool)
  return (
    <div className="d0-toolbar-wrap" data-no-canvas {...shield}>
      <StyleBar />
      <div className="d0-toolbar" role="toolbar" aria-label="Tools">
        {TOOLS.map((t) => (
          <button
            key={t.tool}
            className={`d0-tool ${tool === t.tool ? 'is-active' : ''}`}
            onClick={() => editor.setTool(t.tool)}
            title={`${t.label} (${t.key})`}
            aria-label={t.label}
            aria-pressed={tool === t.tool}
          >
            {t.icon}
          </button>
        ))}
        <div className="d0-toolbar__sep" />
        <button className="d0-tool" onClick={() => runAction(editor, 'new-card')} title="New snippet card (C)" aria-label="New snippet card">
          {Icon.card}
        </button>
        <button className="d0-tool" onClick={() => runAction(editor, 'insert-image')} title={`Insert images or files (${formatKbd('mod+u')})`} aria-label="Insert images">
          {Icon.image}
        </button>
      </div>
    </div>
  )
}

/** Colors (and stroke size) for the draw/note tools, or for selected notes and drawings. */
function StyleBar() {
  const editor = useEditor()
  const tool = useUi((u) => u.tool)
  const inkColor = useUi((u) => u.inkColor)
  const inkSize = useUi((u) => u.inkSize)
  const noteColor = useUi((u) => u.noteColor)
  const selected = useUi((u) => u.selectedIds)
  const shapes = selected.map((id) => editor.getShape(id))
  const notes = shapes.filter((s): s is NoteShape => s?.type === 'note')
  const draws = shapes.filter((s): s is DrawShape => s?.type === 'draw')
  const showInk = tool === 'draw' || (tool === 'select' && draws.length > 0)
  const showNote = tool === 'note' || (tool === 'select' && notes.length > 0)
  if (!showInk && !showNote) return null
  const activeInk = draws[0]?.color ?? inkColor
  const activeSize = draws[0]?.size ?? inkSize
  const activeNote = notes[0]?.color ?? noteColor
  return (
    <div className="d0-stylebar">
      {showInk && (
        <>
          {INK_COLORS.map((c) => (
            <button
              key={c}
              className={`d0-swatch ${activeInk === c ? 'is-active' : ''}`}
              style={{ background: inkVar(c) }}
              title={c}
              aria-label={`Ink ${c}`}
              onClick={() => {
                editor.ui.update({ inkColor: c })
                if (draws.length) editor.updateShapes(draws.map((d) => ({ id: d.id, color: c })))
              }}
            />
          ))}
          <div className="d0-toolbar__sep" />
          {INK_SIZES.map((sz) => (
            <button
              key={sz}
              className={`d0-size ${activeSize === sz ? 'is-active' : ''}`}
              title={`Stroke ${sz}`}
              aria-label={`Stroke size ${sz}`}
              onClick={() => {
                editor.ui.update({ inkSize: sz })
                if (draws.length) editor.updateShapes(draws.map((d) => ({ id: d.id, size: sz })))
              }}
            >
              <i style={{ width: Math.min(14, sz + 2), height: Math.min(14, sz + 2) }} />
            </button>
          ))}
        </>
      )}
      {showInk && showNote && <div className="d0-toolbar__sep" />}
      {showNote &&
        NOTE_COLORS.map((c) => (
          <button
            key={c}
            className={`d0-swatch is-square ${activeNote === c ? 'is-active' : ''}`}
            style={{ background: noteVar(c) }}
            title={`Note ${c}`}
            aria-label={`Note ${c}`}
            onClick={() => {
              editor.ui.update({ noteColor: c })
              if (notes.length) editor.updateShapes(notes.map((n) => ({ id: n.id, color: c })))
            }}
          />
        ))}
    </div>
  )
}

/* ------------------------------ Zoom & minimap ---------------------------- */

export function NavPanel() {
  const editor = useEditor()
  const z = useUi((u) => u.camera.z)
  const [showMap, setShowMap] = useState(() => {
    try {
      return localStorage.getItem('defact0:minimap') !== 'off'
    } catch {
      return true
    }
  })
  const toggle = () => {
    setShowMap(!showMap)
    try {
      localStorage.setItem('defact0:minimap', showMap ? 'off' : 'on')
    } catch {
      /* ignore */
    }
  }
  return (
    <div className="d0-nav" data-no-canvas {...shield}>
      {showMap && <Minimap />}
      <div className="d0-nav__row">
        <button className="d0-icon-btn" onClick={() => editor.zoomOut()} title="Zoom out (-)" aria-label="Zoom out">
          {Icon.minus}
        </button>
        <button className="d0-zoom" onClick={() => editor.resetZoom()} title="Reset to 100% (Shift+0)">
          {Math.round(z * 100)}%
        </button>
        <button className="d0-icon-btn" onClick={() => editor.zoomIn()} title="Zoom in (=)" aria-label="Zoom in">
          {Icon.plus}
        </button>
        <button className="d0-icon-btn" onClick={() => editor.zoomToFit()} title="Zoom to fit (Shift+1)" aria-label="Zoom to fit">
          {Icon.fit}
        </button>
        <span className="d0-spacer" />
        <button className={`d0-icon-btn ${showMap ? 'is-on' : ''}`} onClick={toggle} title="Toggle minimap" aria-label="Toggle minimap">
          {Icon.map}
        </button>
      </div>
    </div>
  )
}

/* --------------------------------- Top bar -------------------------------- */

export function TopBar() {
  const editor = useEditor()
  const panel = useApp((s) => s.panel)
  const selCount = useUi((u) => u.selectedIds.length)
  return (
    <div className="d0-topbar" data-no-canvas {...shield}>
      <button className={`d0-top-btn ${panel === 'search' ? 'is-active' : ''}`} onClick={() => togglePanel('search')} title={`Search (${formatKbd('mod+k')})`}>
        {Icon.search}
        <span>Search</span>
      </button>
      <button className={`d0-top-btn ${panel === 'sessions' ? 'is-active' : ''}`} onClick={() => togglePanel('sessions')} title="Chat sessions (Shift+S)">
        {Icon.sessions}
        <span>Sessions</span>
      </button>
      <button className="d0-top-btn" onClick={() => runAction(editor, 'tag')} disabled={!selCount} title="Tag selection (Shift+T)" aria-label="Tag selection">
        {Icon.tag}
      </button>
      <button className="d0-top-btn" onClick={() => runAction(editor, 'arrange-grid')} disabled={selCount < 2} title="Arrange in a grid (Shift+A)" aria-label="Arrange in grid">
        {Icon.grid}
      </button>
      <button className="d0-top-btn" onClick={() => runAction(editor, 'organize')} title="AI organize (Shift+I)">
        {Icon.sparkle}
        <span>Organize</span>
      </button>
      <button
        className="d0-top-btn"
        onClick={() => runAction(editor, selCount ? 'export-png-selection' : 'export-png-viewport')}
        title={selCount ? `Export selection as PNG (${formatKbd('mod+shift+e')})` : 'Export viewport as PNG'}
        aria-label="Export PNG"
      >
        {Icon.download}
      </button>
    </div>
  )
}

/* ---------------------------------- Toasts -------------------------------- */

export function Toasts() {
  const toasts = useApp((s) => s.toasts)
  return (
    <div className="d0-toasts" data-no-canvas {...shield} aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`d0-toast is-${t.kind ?? 'info'}`}>
          <div className="d0-toast__text">
            <div className="d0-toast__title">{t.title}</div>
            {t.description && <div className="d0-muted">{t.description}</div>}
          </div>
          <div className="d0-toast__actions">
            {t.actions?.map((a) => (
              <button
                key={a.label}
                className={`d0-btn ${a.primary ? 'd0-btn--primary' : ''}`}
                onClick={() => {
                  dismissToast(t.id)
                  a.run()
                }}
              >
                {a.label}
              </button>
            ))}
            <button className="d0-icon-btn" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
              {Icon.close}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------------------------- Shortcuts dialog ---------------------------- */

export function ShortcutsDialog({ onClose }: { onClose(): void }) {
  const groups = ['Tools', 'Edit', 'Organize', 'Arrange', 'View', 'File'] as const
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose} wide>
      <div className="d0-shortcuts">
        <section>
          <h3>Canvas</h3>
          <dl>
            <dt>Pan</dt>
            <dd>
              <kbd>Space</kbd> + drag, middle-drag, or scroll
            </dd>
            <dt>Zoom</dt>
            <dd>Mouse wheel, pinch, or {formatKbd('mod+=')}</dd>
            <dt>Move selection</dt>
            <dd>Arrow keys (Shift = 10px)</dd>
            <dt>Rotate in 15° steps</dt>
            <dd>Shift while rotating</dd>
            <dt>Lock aspect / axis</dt>
            <dd>Shift while resizing or dragging</dd>
            <dt>Copy, cut, paste</dt>
            <dd>
              {formatKbd('mod+c')}, {formatKbd('mod+x')}, {formatKbd('mod+v')}
            </dd>
          </dl>
        </section>
        {groups.map((g) => (
          <section key={g}>
            <h3>{g}</h3>
            <dl>
              {ACTIONS.filter((a) => a.group === g && a.kbd?.length).map((a) => (
                <ShortcutRow key={a.id} label={a.label} kbd={a.kbd!} />
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  )
}

function ShortcutRow({ label, kbd }: { label: string; kbd: string[] }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>
        {kbd.slice(0, 2).map((k, i) => (
          <span key={k}>
            {i > 0 && ' '}
            <kbd>{formatKbd(k)}</kbd>
          </span>
        ))}
      </dd>
    </>
  )
}

/* ------------------------------- Empty state ------------------------------ */

export function EmptyState({ editor }: { editor: Editor }) {
  const empty = useStore(editor.doc, (d) => d.order.length === 0)
  if (!empty) return null
  return (
    <div className="d0-empty-state" aria-hidden>
      <div className="d0-empty-state__logo">defact0</div>
      <p>Drop screenshots, diagrams or code files anywhere.</p>
      <p className="d0-muted">
        Paste <kbd>{formatKbd('mod+v')}</kbd> · snippet <kbd>C</kbd> · note <kbd>N</kbd> · draw <kbd>D</kbd> · frame <kbd>F</kbd> · search{' '}
        <kbd>{formatKbd('mod+k')}</kbd> · help <kbd>?</kbd>
      </p>
    </div>
  )
}
