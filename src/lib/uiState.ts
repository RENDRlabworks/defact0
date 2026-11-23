import { Store, useStore } from '../engine/store'
import type { Vec } from '../engine/types'
import { emptyQuery, type SearchQuery } from './search'

export type Panel = 'search' | 'sessions' | null

export interface Toast {
  id: number
  title: string
  description?: string
  kind?: 'info' | 'success' | 'error'
  actions?: { label: string; primary?: boolean; run(): void }[]
}

export interface AppUi {
  panel: Panel
  query: SearchQuery
  previewId: string | null
  dialog: 'tag' | 'organize' | 'session' | 'shortcuts' | null
  contextMenu: { client: Vec } | null
  menuOpen: boolean
  toasts: Toast[]
}

/** App-level UI state (panels, dialogs, toasts). Canvas state lives in the Editor. */
export const app = new Store<AppUi>({
  panel: null,
  query: emptyQuery,
  previewId: null,
  dialog: null,
  contextMenu: null,
  menuOpen: false,
  toasts: [],
})

export function useApp<S>(selector: (s: AppUi) => S) {
  return useStore(app, selector)
}

export function togglePanel(p: Exclude<Panel, null>) {
  app.update({ panel: app.get().panel === p ? null : p })
}

/** True while a modal or menu owns the keyboard. */
export const isModalOpen = () => {
  const s = app.get()
  return !!(s.previewId || s.dialog || s.contextMenu || s.menuOpen)
}

let toastId = 0
export function toast(t: Omit<Toast, 'id'>, ms = 6000) {
  const id = ++toastId
  app.update({ toasts: [...app.get().toasts, { ...t, id }].slice(-4) })
  if (ms) setTimeout(() => dismissToast(id), ms)
  return id
}
export function dismissToast(id: number) {
  app.update({ toasts: app.get().toasts.filter((t) => t.id !== id) })
}
