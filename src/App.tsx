import { Tldraw, type TLComponents, type TLUiComponents } from 'tldraw'
import 'tldraw/tldraw.css'
import { CardShapeUtil } from './shapes/CardShapeUtil'
import { Defact0TopBar, Defact0Ui } from './ui/Defact0Ui'
import { Defact0ContextMenu, Defact0KeyboardShortcuts, Defact0MainMenu, overrides } from './ui/overrides'

// Defined outside the component so tldraw sees stable references.
const shapeUtils = [CardShapeUtil]
const components: TLComponents & TLUiComponents = {
  SharePanel: Defact0TopBar,
  ContextMenu: Defact0ContextMenu,
  MainMenu: Defact0MainMenu,
  KeyboardShortcutsDialog: Defact0KeyboardShortcuts,
}

// Show the minimap by default (tldraw stores its collapsed state under this key).
try {
  if (localStorage.getItem('minimap') === null) localStorage.setItem('minimap', 'false')
} catch {
  /* storage unavailable */
}

export default function App() {
  return (
    <div className="d0-app">
      <Tldraw
        persistenceKey="defact0"
        shapeUtils={shapeUtils}
        components={components}
        overrides={overrides}
        colorScheme="dark"
        licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY}
        options={{ maxFilesAtOnce: 200 }}
        onMount={(editor) => {
          // Handy for debugging and the smoke tests.
          if (import.meta.env.DEV) (window as unknown as { editor: typeof editor }).editor = editor
        }}
      >
        <Defact0Ui />
      </Tldraw>
    </div>
  )
}
