import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { Editor } from './engine/Editor'
import { EditorProvider } from './engine/react'
import { Canvas } from './engine/render/Canvas'
import { useStore } from './engine/store'
import type { Theme, Vec } from './engine/types'
import { readCamera, startPersistence } from './lib/boot'
import { addFiles, addText, attachClipboard } from './lib/clipboard'
import { app, isModalOpen } from './lib/uiState'
import { ContextMenu, EmptyState, MainMenu, NavPanel, Toasts, Toolbar, TopBar, useShortcuts } from './ui/Chrome'
import { Dialogs } from './ui/Dialogs'
import { PreviewModal } from './ui/PreviewModal'
import { SidePanel } from './ui/SidePanel'

function initialTheme(): Theme {
  try {
    return localStorage.getItem('defact0:theme') === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export default function App() {
  const editor = useMemo(() => new Editor({ theme: initialTheme(), camera: readCamera() }), [])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let stop: (() => void) | undefined
    let cancelled = false
    void startPersistence(editor).then((s) => {
      if (cancelled) return s()
      stop = s
      setReady(true)
    })
    if (import.meta.env.DEV) (window as unknown as { editor: Editor }).editor = editor
    return () => {
      cancelled = true
      stop?.()
    }
  }, [editor])

  // Theme on <html> so CSS variables apply everywhere, remembered per browser.
  const theme = useStore(editor.ui, (u) => u.theme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    try {
      localStorage.setItem('defact0:theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  return (
    <EditorProvider editor={editor}>
      <Shell editor={editor} ready={ready} />
    </EditorProvider>
  )
}

function Shell({ editor, ready }: { editor: Editor; ready: boolean }) {
  useShortcuts()
  const pointer = useRef<Vec | null>(null)

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = document.querySelector('.d0-canvas')
      if (!el) return
      const r = el.getBoundingClientRect()
      pointer.current = editor.screenToPage({ x: e.clientX - r.left, y: e.clientY - r.top })
    }
    window.addEventListener('pointermove', onMove)
    const detach = attachClipboard(editor, { getPointer: () => pointer.current, isBlocked: isModalOpen })
    return () => {
      window.removeEventListener('pointermove', onMove)
      detach()
    }
  }, [editor])

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const at = editor.screenToPage({ x: e.clientX - r.left, y: e.clientY - r.top })
    const files = [...e.dataTransfer.files]
    if (files.length) return void addFiles(editor, files, at)
    const text = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list')
    if (text) addText(editor, text, at)
  }

  return (
    <div className="d0-app">
      <Canvas
        onDropData={onDrop}
        onOpenCard={(id) => app.update({ previewId: id })}
        onContextMenu={(_screen, client) => app.update({ contextMenu: { client } })}
      />
      {ready && <EmptyState editor={editor} />}
      <MainMenu />
      <TopBar />
      <SidePanel />
      <Toolbar />
      <NavPanel />
      <Toasts />
      <ContextMenu />
      <PreviewModal />
      <Dialogs />
    </div>
  )
}
