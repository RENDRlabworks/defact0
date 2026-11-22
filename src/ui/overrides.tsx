import {
  DefaultContextMenu,
  DefaultContextMenuContent,
  DefaultKeyboardShortcutsDialog,
  DefaultKeyboardShortcutsDialogContent,
  DefaultMainMenu,
  DefaultMainMenuContent,
  TldrawUiMenuActionItem,
  TldrawUiMenuGroup,
  TldrawUiMenuSubmenu,
  type TLUiContextMenuProps,
  type TLUiKeyboardShortcutsDialogProps,
  type TLUiOverrides,
} from 'tldraw'
import { arrangeBySimilarity, arrangeGrid } from '../lib/arrangeActions'
import { createTextCard, isCard } from '../lib/canvas'
import { exportCanvasJson, exportPng } from '../lib/exportImport'
import { togglePanel, ui } from '../lib/uiState'
import { pickAndImportJson } from './importJson'

const LABELS: Record<string, string> = {
  'd0.search': 'Search canvas',
  'd0.sessions': 'Chat sessions',
  'd0.tag': 'Tag selection…',
  'd0.new-card': 'New snippet card',
  'd0.preview': 'Open card preview',
  'd0.arrange-grid': 'Arrange in grid',
  'd0.arrange-similar': 'Arrange by visual similarity',
  'd0.arrange-similar-frames': 'Cluster into frames by similarity',
  'd0.organize': 'AI organize…',
  'd0.assign-session': 'Assign to chat session…',
  'd0.export-png-selection': 'Export selection as PNG',
  'd0.export-png-viewport': 'Export viewport as PNG',
  'd0.export-json': 'Export canvas as JSON',
  'd0.import-json': 'Import canvas JSON…',
  'd0.group': 'defact0',
  'd0.arrange': 'Arrange',
  'd0.export': 'Export',
}

const hasSelection = (n = 1) => (editor: { getSelectedShapeIds(): unknown[] }) => editor.getSelectedShapeIds().length >= n

export const overrides: TLUiOverrides = {
  translations: { en: LABELS },
  actions(editor, actions, { addToast }) {
    const add = (a: (typeof actions)[string]) => {
      actions[a.id] = a
    }
    add({ id: 'd0-search', label: 'd0.search', kbd: 'cmd+k,ctrl+k', readonlyOk: true, onSelect: () => togglePanel('search') })
    add({ id: 'd0-sessions', label: 'd0.sessions', kbd: 'shift+s', readonlyOk: true, onSelect: () => togglePanel('sessions') })
    add({
      id: 'd0-tag',
      label: 'd0.tag',
      kbd: 'shift+t',
      isEnabled: hasSelection(),
      onSelect: () => void ui.tagDialog.set(true),
    })
    add({
      id: 'd0-assign-session',
      label: 'd0.assign-session',
      kbd: 'shift+c',
      isEnabled: hasSelection(),
      onSelect: () => void ui.sessionDialog.set(true),
    })
    add({
      id: 'd0-new-card',
      label: 'd0.new-card',
      kbd: 'c',
      onSelect: () => {
        editor.markHistoryStoppingPoint('new card')
        const id = createTextCard(editor, editor.getViewportPageBounds().center, { title: '', text: '' })
        editor.select(id)
        ui.previewId.set(id)
      },
    })
    add({
      id: 'd0-preview',
      label: 'd0.preview',
      kbd: 'p',
      isEnabled: (e) => isCard(e.getOnlySelectedShape()),
      onSelect: () => {
        const s = editor.getOnlySelectedShape()
        if (isCard(s)) ui.previewId.set(s.id)
      },
    })
    add({
      id: 'd0-arrange-grid',
      label: 'd0.arrange-grid',
      kbd: 'shift+a',
      isEnabled: hasSelection(2),
      onSelect: () => arrangeGrid(editor, editor.getSelectedShapeIds()),
    })
    add({
      id: 'd0-arrange-similar',
      label: 'd0.arrange-similar',
      kbd: 'shift+m',
      isEnabled: hasSelection(2),
      onSelect: () => void arrangeBySimilarity(editor, editor.getSelectedShapeIds()),
    })
    add({
      id: 'd0-arrange-similar-frames',
      label: 'd0.arrange-similar-frames',
      kbd: 'shift+alt+m',
      isEnabled: hasSelection(2),
      onSelect: () => void arrangeBySimilarity(editor, editor.getSelectedShapeIds(), { frames: true }),
    })
    add({ id: 'd0-organize', label: 'd0.organize', kbd: 'shift+i', onSelect: () => void ui.organizeDialog.set(true) })
    add({
      id: 'd0-export-png-selection',
      label: 'd0.export-png-selection',
      kbd: 'cmd+shift+e,ctrl+shift+e',
      readonlyOk: true,
      isEnabled: hasSelection(),
      onSelect: async () => {
        await exportPng(editor, 'selection')
      },
    })
    add({
      id: 'd0-export-png-viewport',
      label: 'd0.export-png-viewport',
      readonlyOk: true,
      onSelect: async () => {
        const ok = await exportPng(editor, 'viewport')
        if (!ok) addToast({ title: 'Nothing in view to export', severity: 'warning' })
      },
    })
    add({
      id: 'd0-export-json',
      label: 'd0.export-json',
      kbd: 'cmd+shift+j,ctrl+shift+j',
      readonlyOk: true,
      onSelect: () => exportCanvasJson(editor),
    })
    add({
      id: 'd0-import-json',
      label: 'd0.import-json',
      onSelect: () => pickAndImportJson(editor, addToast),
    })
    return actions
  },
}

function Defact0ArrangeItems() {
  return (
    <>
      <TldrawUiMenuActionItem actionId="d0-arrange-grid" />
      <TldrawUiMenuActionItem actionId="d0-arrange-similar" />
      <TldrawUiMenuActionItem actionId="d0-arrange-similar-frames" />
    </>
  )
}

export function Defact0ContextMenu(props: TLUiContextMenuProps) {
  return (
    <DefaultContextMenu {...props}>
      <TldrawUiMenuGroup id="d0-card">
        <TldrawUiMenuActionItem actionId="d0-preview" />
        <TldrawUiMenuActionItem actionId="d0-tag" />
        <TldrawUiMenuActionItem actionId="d0-assign-session" />
      </TldrawUiMenuGroup>
      <TldrawUiMenuGroup id="d0-arrange">
        <TldrawUiMenuSubmenu id="d0-arrange-sub" label="d0.arrange">
          <TldrawUiMenuGroup id="d0-arrange-items">
            <Defact0ArrangeItems />
          </TldrawUiMenuGroup>
        </TldrawUiMenuSubmenu>
        <TldrawUiMenuActionItem actionId="d0-export-png-selection" />
      </TldrawUiMenuGroup>
      <DefaultContextMenuContent />
    </DefaultContextMenu>
  )
}

export function Defact0MainMenu() {
  return (
    <DefaultMainMenu>
      <TldrawUiMenuGroup id="d0-main">
        <TldrawUiMenuActionItem actionId="d0-search" />
        <TldrawUiMenuActionItem actionId="d0-sessions" />
        <TldrawUiMenuActionItem actionId="d0-organize" />
      </TldrawUiMenuGroup>
      <TldrawUiMenuGroup id="d0-io">
        <TldrawUiMenuSubmenu id="d0-export-sub" label="d0.export">
          <TldrawUiMenuGroup id="d0-export-items">
            <TldrawUiMenuActionItem actionId="d0-export-json" />
            <TldrawUiMenuActionItem actionId="d0-import-json" />
            <TldrawUiMenuActionItem actionId="d0-export-png-viewport" />
            <TldrawUiMenuActionItem actionId="d0-export-png-selection" />
          </TldrawUiMenuGroup>
        </TldrawUiMenuSubmenu>
      </TldrawUiMenuGroup>
      <DefaultMainMenuContent />
    </DefaultMainMenu>
  )
}

export function Defact0KeyboardShortcuts(props: TLUiKeyboardShortcutsDialogProps) {
  return (
    <DefaultKeyboardShortcutsDialog {...props}>
      <TldrawUiMenuGroup id="d0-shortcuts" label="d0.group">
        <TldrawUiMenuActionItem actionId="d0-search" />
        <TldrawUiMenuActionItem actionId="d0-sessions" />
        <TldrawUiMenuActionItem actionId="d0-new-card" />
        <TldrawUiMenuActionItem actionId="d0-preview" />
        <TldrawUiMenuActionItem actionId="d0-tag" />
        <TldrawUiMenuActionItem actionId="d0-assign-session" />
        <Defact0ArrangeItems />
        <TldrawUiMenuActionItem actionId="d0-organize" />
        <TldrawUiMenuActionItem actionId="d0-export-png-selection" />
        <TldrawUiMenuActionItem actionId="d0-export-json" />
      </TldrawUiMenuGroup>
      <DefaultKeyboardShortcutsDialogContent />
    </DefaultKeyboardShortcutsDialog>
  )
}
