import { useEffect, useRef, useState } from 'react'
import { add, HANDLE_ANCHOR, HANDLES, pageToScreen, rot, shapeCorners, type Handle } from '../geometry'
import { useDoc, useEditor, useUi } from '../react'
import type { Camera, FrameShape, Shape, Vec } from '../types'

const CURSORS: Record<Handle, string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
}

const pts = (ps: Vec[]) => ps.map((p) => `${p.x},${p.y}`).join(' ')

/** Screen-space UI over the canvas: frame labels, selection, handles, marquee. */
export function Overlay() {
  const camera = useUi((u) => u.camera)
  const selectedIds = useUi((u) => u.selectedIds)
  const brush = useUi((u) => u.brush)
  const creating = useUi((u) => u.creating)
  const isDragging = useUi((u) => u.isDragging)
  const tool = useUi((u) => u.tool)
  const shapes = useDoc((d) => d.shapes, (a, b) => a === b)
  const frames = useDoc((d) => d.order.map((id) => d.shapes[id]).filter((s): s is FrameShape => s?.type === 'frame'))
  const selected = selectedIds.map((id) => shapes[id]).filter((s): s is Shape => !!s)

  return (
    <div className="d0-overlay">
      {frames.map((f) => (
        <FrameLabel key={f.id} frame={f} camera={camera} selected={selectedIds.includes(f.id)} />
      ))}
      <svg className="d0-overlay__svg">
        {selected.length > 1 &&
          selected.map((s) => <polygon key={s.id} points={pts(shapeCorners(s).map((p) => pageToScreen(p, camera)))} className="d0-sel-outline is-faint" />)}
        {brush && (
          <rect
            className="d0-brush"
            x={(brush.x + camera.x) * camera.z}
            y={(brush.y + camera.y) * camera.z}
            width={brush.w * camera.z}
            height={brush.h * camera.z}
          />
        )}
        {creating && (
          <rect
            className="d0-creating"
            x={(creating.x + camera.x) * camera.z}
            y={(creating.y + camera.y) * camera.z}
            width={creating.w * camera.z}
            height={creating.h * camera.z}
          />
        )}
      </svg>
      {selected.length > 0 && tool === 'select' && <SelectionBox shapes={selected} camera={camera} showHandles={!isDragging} />}
    </div>
  )
}

function SelectionBox({ shapes, camera, showHandles }: { shapes: Shape[]; camera: Camera; showHandles: boolean }) {
  const editor = useEditor()
  const single = shapes.length === 1 ? shapes[0] : null
  // Box in "local" space: for one shape, its rotated box; for many, the axis-aligned union.
  const box = single ?? { ...editor.getBoundsOf(shapes.map((s) => s.id))!, rotation: 0 }
  const corners = shapeCorners(box).map((p) => pageToScreen(p, camera))
  const w = box.w * camera.z
  const h = box.h * camera.z
  const small = w < 36 || h < 36
  const canRotate = shapes.some((s) => s.type !== 'frame')
  const toScreen = (lx: number, ly: number) => {
    const c = { x: box.x + box.w / 2, y: box.y + box.h / 2 }
    return pageToScreen(add(c, rot({ x: lx - box.w / 2, y: ly - box.h / 2 }, box.rotation)), camera)
  }
  const rotateAt = (() => {
    const top = toScreen(box.w / 2, 0)
    const dir = rot({ x: 0, y: -1 }, box.rotation)
    return { x: top.x + dir.x * 26, y: top.y + dir.y * 26 }
  })()
  return (
    <>
      <svg className="d0-overlay__svg">
        <polygon points={pts(corners)} className="d0-sel-outline" />
        {showHandles && canRotate && (
          <line x1={toScreen(box.w / 2, 0).x} y1={toScreen(box.w / 2, 0).y} x2={rotateAt.x} y2={rotateAt.y} className="d0-sel-outline" />
        )}
      </svg>
      {showHandles &&
        HANDLES.filter((hd) => !small || hd.length === 2).map((hd) => {
          const a = HANDLE_ANCHOR[hd]
          const p = toScreen(a.x * box.w, a.y * box.h)
          return (
            <div
              key={hd}
              data-handle={hd}
              className={`d0-handle ${hd.length === 1 ? 'is-edge' : ''}`}
              style={{ transform: `translate(${p.x}px, ${p.y}px) rotate(${box.rotation}rad)`, cursor: CURSORS[hd] }}
            />
          )
        })}
      {showHandles && canRotate && (
        <div data-handle="rotate" className="d0-handle d0-handle--rotate" style={{ transform: `translate(${rotateAt.x}px, ${rotateAt.y}px)` }} title="Rotate (Shift snaps 15°)" />
      )}
    </>
  )
}

function FrameLabel({ frame, camera, selected }: { frame: FrameShape; camera: Camera; selected: boolean }) {
  const editor = useEditor()
  const editing = useUi((u) => u.editingId === frame.id)
  const p = pageToScreen({ x: frame.x, y: frame.y }, camera)
  const maxW = Math.max(40, frame.w * camera.z)
  if (editing) return <FrameNameInput frame={frame} x={p.x} y={p.y} />
  return (
    <div
      className={`d0-frame-label ${selected ? 'is-selected' : ''}`}
      data-frame-label={frame.id}
      style={{ transform: `translate(${p.x}px, ${p.y - 22}px)`, maxWidth: maxW }}
      title="Drag to move · double-click to rename"
      onDoubleClick={(e) => {
        e.stopPropagation()
        editor.setEditing(frame.id)
      }}
    >
      {frame.name || 'Frame'}
    </div>
  )
}

function FrameNameInput({ frame, x, y }: { frame: FrameShape; x: number; y: number }) {
  const editor = useEditor()
  const [value, setValue] = useState(frame.name)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.select()
  }, [])
  const commit = () => {
    if (value.trim() && value !== frame.name) editor.updateShape({ id: frame.id, name: value.trim() })
    editor.setEditing(null)
  }
  return (
    <input
      ref={ref}
      data-no-canvas
      className="d0-frame-label d0-frame-label--input"
      style={{ transform: `translate(${x}px, ${y - 24}px)` }}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') editor.setEditing(null)
      }}
    />
  )
}
