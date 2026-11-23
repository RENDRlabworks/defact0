import { useEffect, useRef, type DragEvent } from 'react'
import { Interactions, type InteractionCallbacks } from '../interaction'
import { useDoc, useEditor, useUi } from '../react'
import { Overlay } from './Overlay'
import { LiveStroke, ShapeView } from './ShapeViews'

export interface CanvasProps extends InteractionCallbacks {
  onDropData(e: DragEvent<HTMLDivElement>): void
}

/** The infinite canvas: a dotted background, the page-space world layer, and the screen-space overlay. */
export function Canvas(props: CanvasProps) {
  const editor = useEditor()
  const rootRef = useRef<HTMLDivElement>(null)
  const cbRef = useRef(props)
  cbRef.current = props

  useEffect(() => {
    const root = rootRef.current!
    const ro = new ResizeObserver(() => {
      const r = root.getBoundingClientRect()
      editor.setViewport(r.width, r.height)
    })
    ro.observe(root)
    const detach = new Interactions(editor, root, {
      onOpenCard: (id) => cbRef.current.onOpenCard(id),
      onContextMenu: (s, c) => cbRef.current.onContextMenu(s, c),
    }).attach()
    return () => {
      ro.disconnect()
      detach()
    }
  }, [editor])

  const tool = useUi((u) => u.tool)
  const spaceHeld = useUi((u) => u.spaceHeld)

  return (
    <div
      ref={rootRef}
      className={`d0-canvas tool-${tool} ${spaceHeld ? 'is-space' : ''}`}
      tabIndex={-1}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={(e) => {
        e.preventDefault()
        props.onDropData(e)
      }}
    >
      <Background />
      <World />
      <Overlay />
    </div>
  )
}

function Background() {
  const camera = useUi((u) => u.camera)
  // Dot grid that scales with zoom, fading out when dots would get too dense.
  const base = 24
  let step = base * camera.z
  while (step < 12) step *= 4
  const ox = (camera.x * camera.z) % step
  const oy = (camera.y * camera.z) % step
  return (
    <div
      className="d0-background"
      style={{ backgroundSize: `${step}px ${step}px`, backgroundPosition: `${ox}px ${oy}px` }}
    />
  )
}

function World() {
  const camera = useUi((u) => u.camera)
  return (
    <div className="d0-world" style={{ transform: `scale(${camera.z}) translate(${camera.x}px, ${camera.y}px)` }}>
      <Shapes />
      <LiveStroke />
    </div>
  )
}

function Shapes() {
  const editor = useEditor()
  // Re-render the list only when the doc changes; each ShapeView is memoized by shape identity.
  const shapes = useDoc(() => editor.getRenderOrder())
  return (
    <>
      {shapes.map((s) => (
        <ShapeView key={s.id} shape={s} />
      ))}
    </>
  )
}
