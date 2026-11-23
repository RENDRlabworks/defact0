import type { Editor } from '../engine/Editor'
import type { Tool } from '../engine/types'
import { arrangeBySimilarity, arrangeGrid } from '../lib/arrangeActions'
import { createTextCard } from '../lib/canvas'
import { exportCanvasJson, exportPng } from '../lib/exportImport'
import { app, toast, togglePanel } from '../lib/uiState'
import { pickAndImportJson, pickImages } from './filePickers'

export interface Action {
  id: string
  label: string
  /** Shortcut combos like "mod+shift+e" ("mod" = Cmd on Mac, Ctrl elsewhere). */
  kbd?: string[]
  group: 'Tools' | 'Edit' | 'Arrange' | 'View' | 'Organize' | 'File'
  enabled?(editor: Editor): boolean
  run(editor: Editor): void
}

const sel = (n = 1) => (e: Editor) => e.getSelectedIds().length >= n
const hasCard = (e: Editor) => e.getOnlySelected()?.type === 'card'
const tool = (t: Tool, label: string, key: string): Action => ({ id: `tool-${t}`, label, kbd: [key], group: 'Tools', run: (e) => e.setTool(t) })

export const ACTIONS: Action[] = [
  tool('select', 'Select', 'v'),
  tool('hand', 'Hand (pan)', 'h'),
  tool('draw', 'Draw', 'd'),
  tool('note', 'Sticky note', 'n'),
  tool('frame', 'Frame', 'f'),
  {
    id: 'new-card',
    label: 'New snippet card',
    kbd: ['c'],
    group: 'Tools',
    run: (e) => {
      const id = createTextCard(e, e.getViewportCenter(), { title: '', text: '' })
      e.setTool('select')
      e.select([id])
      app.update({ previewId: id })
    },
  },
  { id: 'insert-image', label: 'Insert images…', kbd: ['mod+u'], group: 'Tools', run: (e) => pickImages(e) },

  { id: 'undo', label: 'Undo', kbd: ['mod+z'], group: 'Edit', enabled: (e) => e.history.get().canUndo, run: (e) => e.undo() },
  { id: 'redo', label: 'Redo', kbd: ['mod+shift+z', 'mod+y'], group: 'Edit', enabled: (e) => e.history.get().canRedo, run: (e) => e.redo() },
  { id: 'select-all', label: 'Select all', kbd: ['mod+a'], group: 'Edit', run: (e) => (e.setTool('select'), e.selectAll()) },
  { id: 'deselect', label: 'Deselect', kbd: ['escape'], group: 'Edit', run: (e) => (e.ui.get().tool !== 'select' ? e.setTool('select') : e.selectNone()) },
  { id: 'delete', label: 'Delete', kbd: ['delete', 'backspace'], group: 'Edit', enabled: sel(), run: (e) => e.deleteShapes(e.getSelectedIds()) },
  {
    id: 'duplicate',
    label: 'Duplicate',
    kbd: ['mod+d'],
    group: 'Edit',
    enabled: sel(),
    run: (e) => e.select(e.duplicate(e.getSelectedIds())),
  },
  {
    id: 'preview',
    label: 'Open / edit',
    kbd: ['p', 'enter'],
    group: 'Edit',
    enabled: (e) => hasCard(e) || e.getOnlySelected()?.type === 'note' || e.getOnlySelected()?.type === 'frame',
    run: (e) => {
      const s = e.getOnlySelected()
      if (s?.type === 'card') app.update({ previewId: s.id })
      else if (s) e.setEditing(s.id)
    },
  },
  { id: 'tag', label: 'Tag selection…', kbd: ['shift+t'], group: 'Organize', enabled: sel(), run: () => app.update({ dialog: 'tag' }) },
  { id: 'assign-session', label: 'Assign to chat session…', kbd: ['shift+c'], group: 'Organize', enabled: sel(), run: () => app.update({ dialog: 'session' }) },
  { id: 'search', label: 'Search canvas', kbd: ['mod+k', '/'], group: 'Organize', run: () => togglePanel('search') },
  { id: 'sessions', label: 'Chat sessions', kbd: ['shift+s'], group: 'Organize', run: () => togglePanel('sessions') },
  { id: 'organize', label: 'AI organize…', kbd: ['shift+i'], group: 'Organize', run: () => app.update({ dialog: 'organize' }) },

  {
    id: 'group',
    label: 'Group into frame',
    kbd: ['mod+g'],
    group: 'Arrange',
    enabled: sel(),
    run: (e) => {
      const id = e.frameShapes(e.getSelectedIds(), 'Group')
      if (id) e.select([id])
    },
  },
  {
    id: 'ungroup',
    label: 'Remove frame (keep contents)',
    kbd: ['mod+shift+g'],
    group: 'Arrange',
    enabled: (e) => e.getSelectedShapes().some((s) => s.type === 'frame'),
    run: (e) => e.unframe(e.getSelectedIds()),
  },
  { id: 'arrange-grid', label: 'Arrange in grid', kbd: ['shift+a'], group: 'Arrange', enabled: sel(2), run: (e) => arrangeGrid(e, e.getSelectedIds()) },
  {
    id: 'arrange-similar',
    label: 'Arrange by visual similarity',
    kbd: ['shift+m'],
    group: 'Arrange',
    enabled: sel(2),
    run: (e) => void arrangeBySimilarity(e, e.getSelectedIds()),
  },
  {
    id: 'arrange-similar-frames',
    label: 'Cluster into frames by similarity',
    kbd: ['shift+alt+m'],
    group: 'Arrange',
    enabled: sel(2),
    run: (e) => void arrangeBySimilarity(e, e.getSelectedIds(), { frames: true }),
  },
  { id: 'bring-front', label: 'Bring to front', kbd: ['shift+]'], group: 'Arrange', enabled: sel(), run: (e) => e.bringToFront(e.getSelectedIds()) },
  { id: 'bring-forward', label: 'Bring forward', kbd: [']'], group: 'Arrange', enabled: sel(), run: (e) => e.bringForward(e.getSelectedIds()) },
  { id: 'send-backward', label: 'Send backward', kbd: ['['], group: 'Arrange', enabled: sel(), run: (e) => e.sendBackward(e.getSelectedIds()) },
  { id: 'send-back', label: 'Send to back', kbd: ['shift+['], group: 'Arrange', enabled: sel(), run: (e) => e.sendToBack(e.getSelectedIds()) },

  { id: 'zoom-in', label: 'Zoom in', kbd: ['mod+=', '=', '+'], group: 'View', run: (e) => e.zoomIn() },
  { id: 'zoom-out', label: 'Zoom out', kbd: ['mod+-', '-'], group: 'View', run: (e) => e.zoomOut() },
  { id: 'zoom-100', label: 'Zoom to 100%', kbd: ['shift+0', 'mod+0'], group: 'View', run: (e) => e.resetZoom() },
  { id: 'zoom-fit', label: 'Zoom to fit', kbd: ['shift+1'], group: 'View', run: (e) => e.zoomToFit() },
  { id: 'zoom-selection', label: 'Zoom to selection', kbd: ['shift+2'], group: 'View', enabled: sel(), run: (e) => e.zoomToSelection() },
  {
    id: 'toggle-theme',
    label: 'Toggle dark mode',
    kbd: ['mod+shift+l'],
    group: 'View',
    run: (e) => e.ui.update({ theme: e.ui.get().theme === 'dark' ? 'light' : 'dark' }),
  },
  { id: 'shortcuts', label: 'Keyboard shortcuts', kbd: ['?', 'mod+/'], group: 'View', run: () => app.update({ dialog: 'shortcuts' }) },

  {
    id: 'export-png-selection',
    label: 'Export selection as PNG',
    kbd: ['mod+shift+e'],
    group: 'File',
    enabled: sel(),
    run: (e) => void exportPng(e, 'selection'),
  },
  {
    id: 'export-png-viewport',
    label: 'Export viewport as PNG',
    group: 'File',
    run: async (e) => {
      if (!(await exportPng(e, 'viewport'))) toast({ title: 'Nothing to export' })
    },
  },
  { id: 'export-json', label: 'Export canvas as JSON', kbd: ['mod+shift+j'], group: 'File', run: (e) => void exportCanvasJson(e) },
  { id: 'import-json', label: 'Import canvas JSON…', group: 'File', run: (e) => pickAndImportJson(e) },
]

export const actionById = Object.fromEntries(ACTIONS.map((a) => [a.id, a])) as Record<string, Action>

export function runAction(editor: Editor, id: string) {
  const a = actionById[id]
  if (a && (!a.enabled || a.enabled(editor))) a.run(editor)
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** "mod+shift+e" -> "⌘⇧E" (Mac) or "Ctrl+Shift+E". */
export function formatKbd(combo: string): string {
  const parts = combo.split('+').filter(Boolean)
  const keyPart = combo.endsWith('++') ? '+' : parts[parts.length - 1]
  const mods = combo.endsWith('++') ? parts : parts.slice(0, -1)
  const names: Record<string, [string, string]> = {
    mod: ['⌘', 'Ctrl'],
    shift: ['⇧', 'Shift'],
    alt: ['⌥', 'Alt'],
  }
  const keyNames: Record<string, string> = { escape: 'Esc', delete: '⌫', backspace: '⌫', enter: '↵' }
  const key = keyNames[keyPart] ?? keyPart.toUpperCase()
  if (isMac) return mods.map((m) => names[m][0]).join('') + key
  return [...mods.map((m) => names[m][1]), key].join('+')
}

/** Normalize a KeyboardEvent to our combo format. */
export function comboFromEvent(e: KeyboardEvent): string {
  if (e.key === '?') return '?'
  const mods: string[] = []
  if (e.metaKey || e.ctrlKey) mods.push('mod')
  if (e.shiftKey) mods.push('shift')
  if (e.altKey) mods.push('alt')
  let key = e.key.toLowerCase()
  // Use the physical key for letters/digits so Shift/Alt variants still match ("shift+1", "alt+m").
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3).toLowerCase()
  else if (/^Digit[0-9]$/.test(e.code)) key = e.code.slice(5)
  else if (e.code === 'BracketLeft') key = '['
  else if (e.code === 'BracketRight') key = ']'
  else if (e.code === 'Equal') key = '='
  else if (e.code === 'Minus') key = '-'
  else if (e.code === 'Slash') key = e.shiftKey ? '?' : '/'
  if (key === '?' || key === '+') return key
  return [...mods, key].join('+')
}
