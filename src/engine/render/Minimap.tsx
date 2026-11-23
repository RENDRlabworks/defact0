import { useEffect, useRef } from 'react'
import { boxUnion, expandBox, shapeBounds } from '../geometry'
import { useEditor } from '../react'
import type { Box } from '../types'

const W = 200
const H = 128

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/** Overview of the whole canvas. Click or drag to move the camera. */
export function Minimap() {
  const editor = useEditor()
  const ref = useRef<HTMLCanvasElement>(null)
  const frame = useRef<{ world: Box; scale: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    const canvas = ref.current!
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')!
    let raf = 0
    const draw = () => {
      raf = 0
      const shapes = editor.getShapes()
      const view = editor.getViewportPageBox()
      const content = boxUnion(shapes.map(shapeBounds))
      const world = expandBox(boxUnion(content ? [content, view] : [view])!, 200)
      const scale = Math.min(W / world.w, H / world.h)
      const ox = (W - world.w * scale) / 2
      const oy = (H - world.h * scale) / 2
      frame.current = { world, scale, ox, oy }
      const tx = (x: number) => ox + (x - world.x) * scale
      const ty = (y: number) => oy + (y - world.y) * scale
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      const sel = new Set(editor.getSelectedIds())
      const accent = cssVar('--d0-accent')
      for (const s of editor.getRenderOrder()) {
        const b = shapeBounds(s)
        const x = tx(b.x)
        const y = ty(b.y)
        const w = Math.max(1.5, b.w * scale)
        const h = Math.max(1.5, b.h * scale)
        if (s.type === 'frame') {
          ctx.strokeStyle = sel.has(s.id) ? accent : cssVar('--d0-muted')
          ctx.lineWidth = 1
          ctx.strokeRect(x + 0.5, y + 0.5, w, h)
        } else {
          ctx.fillStyle = sel.has(s.id) ? accent : s.type === 'note' ? cssVar('--note-yellow') : s.type === 'draw' ? cssVar('--d0-muted') : cssVar('--d0-minimap-card')
          ctx.fillRect(x, y, w, h)
        }
      }
      ctx.strokeStyle = accent
      ctx.lineWidth = 1.5
      ctx.strokeRect(tx(view.x), ty(view.y), view.w * scale, view.h * scale)
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(draw)
    }
    draw()
    const u1 = editor.doc.subscribe(schedule)
    const u2 = editor.ui.subscribe(schedule)
    return () => {
      u1()
      u2()
      cancelAnimationFrame(raf)
    }
  }, [editor])

  const moveTo = (e: React.PointerEvent) => {
    const f = frame.current
    if (!f) return
    const r = ref.current!.getBoundingClientRect()
    const px = f.world.x + (e.clientX - r.left - f.ox) / f.scale
    const py = f.world.y + (e.clientY - r.top - f.oy) / f.scale
    const { viewport, camera } = editor.ui.get()
    editor.setCamera({ x: viewport.w / 2 / camera.z - px, y: viewport.h / 2 / camera.z - py, z: camera.z })
  }

  return (
    <canvas
      ref={ref}
      className="d0-minimap"
      style={{ width: W, height: H }}
      aria-label="Minimap"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        moveTo(e)
      }}
      onPointerMove={(e) => {
        if (e.buttons) moveTo(e)
      }}
    />
  )
}
