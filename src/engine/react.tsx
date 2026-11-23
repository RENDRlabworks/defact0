import { createContext, useContext, type ReactNode } from 'react'
import type { Editor, UiState } from './Editor'
import { useStore } from './store'
import type { Doc } from './types'

const EditorContext = createContext<Editor | null>(null)

export function EditorProvider({ editor, children }: { editor: Editor; children: ReactNode }) {
  return <EditorContext.Provider value={editor}>{children}</EditorContext.Provider>
}

export function useEditor(): Editor {
  const e = useContext(EditorContext)
  if (!e) throw new Error('useEditor must be used inside <EditorProvider>')
  return e
}

/** Subscribe to a slice of UI state (camera, selection, tool...). */
export function useUi<S>(selector: (ui: UiState) => S, equal?: (a: S, b: S) => boolean): S {
  return useStore(useEditor().ui, selector, equal)
}

/** Subscribe to a slice of the document. */
export function useDoc<S>(selector: (doc: Doc) => S, equal?: (a: S, b: S) => boolean): S {
  return useStore(useEditor().doc, selector, equal)
}

/** Re-render on any doc change and compute something from the editor. */
export function useDerived<S>(fn: (editor: Editor) => S, equal?: (a: S, b: S) => boolean): S {
  const editor = useEditor()
  return useStore(editor.doc, () => fn(editor), equal)
}
