import { atom } from 'tldraw'
import { emptyQuery, type SearchQuery } from './search'

export type Panel = 'search' | 'sessions' | null

/** App-level UI state, kept in tldraw signals so any component can react with useValue. */
export const ui = {
  panel: atom<Panel>('panel', null),
  query: atom<SearchQuery>('query', emptyQuery),
  previewId: atom<string | null>('previewId', null),
  tagDialog: atom<boolean>('tagDialog', false),
  organizeDialog: atom<boolean>('organizeDialog', false),
  sessionDialog: atom<boolean>('sessionDialog', false),
}

export function togglePanel(p: Exclude<Panel, null>) {
  ui.panel.set(ui.panel.get() === p ? null : p)
}
