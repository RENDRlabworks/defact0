import type { Editor } from './Editor'
import {
  angleOf,
  boxCenter,
  boxContainsPoint,
  boxFromPoints,
  dist,
  HANDLE_ANCHOR,
  pointsBounds,
  resizeBox,
  rotateAround,
  shapeCenter,
  snapAngle,
  sub,
  type Handle,
} from './geometry'
import type { Box, Camera, Shape, ShapePatch, Vec } from './types'

export interface InteractionCallbacks {
  onOpenCard(id: string): void
  onContextMenu(screen: Vec, client: Vec): void
}

type State =
  | { t: 'idle' }
  | { t: 'pan'; start: Vec; cam: Camera }
  | { t: 'pinch' }
  | { t: 'pending'; start: Vec; startPage: Vec; hitId: string | null; part: 'body' | 'interior' | 'label' | 'selection'; selectOnUp: string | null; shift: boolean }
  | { t: 'translate'; startPage: Vec; ids: string[]; initial: Map<string, Vec>; last: Vec }
  | { t: 'brush'; startPage: Vec; base: string[] }
  | { t: 'resize'; handle: Handle; initial: Map<string, Shape>; box: Box }
  | { t: 'rotate'; center: Vec; startAngle: number; initial: Map<string, Shape> }
  | { t: 'draw'; points: number[] }
  | { t: 'frame'; startPage: Vec }

const DRAG_PX = 4

function isEditableTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

/**
 * Pointer, wheel and touch handling for the canvas. A small state machine:
 * idle -> pending (pointer down) -> translate | brush, or directly pan / resize / rotate / draw / frame.
 */
export class Interactions {
  private state: State = { t: 'idle' }
  private rect: DOMRect = new DOMRect()
  private touches = new Map<number, Vec>()
  private pinchStart: { dist: number; mid: Vec; cam: Camera } | null = null

  constructor(
    private editor: Editor,
    private root: HTMLElement,
    private cb: InteractionCallbacks
  ) {}

  attach() {
    const r = this.root
    const opts = { passive: false } as const
    r.addEventListener('pointerdown', this.onDown)
    r.addEventListener('pointermove', this.onMove)
    r.addEventListener('pointerup', this.onUp)
    r.addEventListener('pointercancel', this.onCancel)
    r.addEventListener('wheel', this.onWheel, opts)
    r.addEventListener('dblclick', this.onDoubleClick)
    r.addEventListener('contextmenu', this.onContextMenu)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    // Safari pinch gestures.
    r.addEventListener('gesturestart', prevent as EventListener)
    r.addEventListener('gesturechange', prevent as EventListener)
    return () => {
      r.removeEventListener('pointerdown', this.onDown)
      r.removeEventListener('pointermove', this.onMove)
      r.removeEventListener('pointerup', this.onUp)
      r.removeEventListener('pointercancel', this.onCancel)
      r.removeEventListener('wheel', this.onWheel)
      r.removeEventListener('dblclick', this.onDoubleClick)
      r.removeEventListener('contextmenu', this.onContextMenu)
      window.removeEventListener('keydown', this.onKeyDown)
      window.removeEventListener('keyup', this.onKeyUp)
      window.removeEventListener('blur', this.onBlur)
      r.removeEventListener('gesturestart', prevent as EventListener)
      r.removeEventListener('gesturechange', prevent as EventListener)
    }
  }

  private screen(e: { clientX: number; clientY: number }): Vec {
    return { x: e.clientX - this.rect.left, y: e.clientY - this.rect.top }
  }

  private setState(s: State) {
    this.state = s
    const dragging = s.t !== 'idle' && s.t !== 'pending'
    if (this.editor.ui.get().isDragging !== dragging) this.editor.ui.update({ isDragging: dragging })
    this.root.dataset.state = s.t
  }

  /* --------------------------------- Down --------------------------------- */

  private onDown = (e: PointerEvent) => {
    if (isEditableTarget(e.target)) return
    if ((e.target as HTMLElement).closest('[data-no-canvas]')) return
    this.rect = this.root.getBoundingClientRect()
    const ed = this.editor
    const screen = this.screen(e)
    const page = ed.screenToPage(screen)
    const ui = ed.ui.get()

    if (e.pointerType === 'touch') {
      this.touches.set(e.pointerId, screen)
      if (this.touches.size === 2) {
        this.cancelCurrent()
        const [a, b] = [...this.touches.values()]
        this.pinchStart = { dist: dist(a, b), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, cam: ed.getCamera() }
        this.setState({ t: 'pinch' })
        return
      }
    }
    if (e.button === 2) return // context menu handles it
    if (ui.editingId) ed.setEditing(null)

    this.root.setPointerCapture?.(e.pointerId)

    if (e.button === 1 || ui.spaceHeld || ui.tool === 'hand') {
      e.preventDefault()
      return this.setState({ t: 'pan', start: screen, cam: ed.getCamera() })
    }

    if (ui.tool === 'draw') {
      const pressure = e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5
      const points = [page.x, page.y, pressure]
      ed.ui.update({ drawing: points })
      return this.setState({ t: 'draw', points })
    }
    if (ui.tool === 'note') {
      e.preventDefault() // keep focus for the note's textarea
      const id = ed.createShape({ type: 'note', x: page.x - 100, y: page.y - 100 })
      ed.reparent([id])
      ed.setTool('select')
      ed.setEditing(id)
      return
    }
    if (ui.tool === 'frame') return this.setState({ t: 'frame', startPage: page })

    // Select tool.
    const target = e.target as HTMLElement
    const handleEl = target.closest<HTMLElement>('[data-handle]')
    if (handleEl) return this.startTransform(handleEl.dataset.handle!, page)

    const labelEl = target.closest<HTMLElement>('[data-frame-label]')
    if (labelEl) {
      const id = labelEl.dataset.frameLabel!
      if (e.shiftKey) ed.toggleSelection(id)
      else if (!ed.getSelectedIds().includes(id)) ed.select([id])
      return this.setState({ t: 'pending', start: screen, startPage: page, hitId: id, part: 'label', selectOnUp: null, shift: e.shiftKey })
    }

    const hit = ed.getShapeAt(page, 3 / ed.getCamera().z)
    const sel = ed.getSelectedIds()
    if (hit && hit.part === 'body') {
      const id = hit.shape.id
      let selectOnUp: string | null = null
      if (e.shiftKey) ed.toggleSelection(id)
      else if (!sel.includes(id)) ed.select([id])
      else if (sel.length > 1) selectOnUp = id
      return this.setState({ t: 'pending', start: screen, startPage: page, hitId: id, part: 'body', selectOnUp, shift: e.shiftKey })
    }
    // Inside the current (multi) selection box: drag the whole selection.
    const selBox = ed.getSelectionBounds()
    if (selBox && sel.length > 1 && boxContainsPoint(selBox, page) && !e.shiftKey) {
      return this.setState({ t: 'pending', start: screen, startPage: page, hitId: null, part: 'selection', selectOnUp: null, shift: false })
    }
    if (hit && hit.part === 'interior') {
      return this.setState({ t: 'pending', start: screen, startPage: page, hitId: hit.shape.id, part: 'interior', selectOnUp: null, shift: e.shiftKey })
    }
    // Empty canvas. One finger on touch pans; otherwise start a marquee.
    if (e.pointerType === 'touch') return this.setState({ t: 'pan', start: screen, cam: ed.getCamera() })
    if (!e.shiftKey) ed.selectNone()
    this.setState({ t: 'pending', start: screen, startPage: page, hitId: null, part: 'interior', selectOnUp: null, shift: e.shiftKey })
  }

  private startTransform(handle: string, page: Vec) {
    const ed = this.editor
    const shapes = ed.getSelectedShapes()
    if (!shapes.length) return
    const all = handle === 'rotate' ? shapes.filter((s) => s.type !== 'frame') : shapes
    const initial = new Map(all.map((s) => [s.id, s]))
    ed.beginInteraction()
    if (handle === 'rotate') {
      const center = shapes.length === 1 ? shapeCenter(shapes[0]) : boxCenter(ed.getSelectionBounds()!)
      return this.setState({ t: 'rotate', center, startAngle: angleOf(center, page), initial })
    }
    this.setState({ t: 'resize', handle: handle as Handle, initial, box: ed.getSelectionBounds()! })
  }

  /* --------------------------------- Move --------------------------------- */

  private onMove = (e: PointerEvent): void => {
    const ed = this.editor
    if (e.pointerType === 'touch' && this.touches.has(e.pointerId)) {
      this.touches.set(e.pointerId, this.screen(e))
      if (this.state.t === 'pinch' && this.touches.size >= 2 && this.pinchStart) {
        const [a, b] = [...this.touches.values()]
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        const { cam, dist: d0, mid: m0 } = this.pinchStart
        const z = Math.min(8, Math.max(0.05, (cam.z * dist(a, b)) / Math.max(1, d0)))
        const anchor = { x: m0.x / cam.z - cam.x, y: m0.y / cam.z - cam.y }
        ed.setCamera({ x: mid.x / z - anchor.x, y: mid.y / z - anchor.y, z })
        return
      }
    }
    const s = this.state
    if (s.t === 'idle' || s.t === 'pinch') return
    const screen = this.screen(e)
    const page = ed.screenToPage(screen)

    switch (s.t) {
      case 'pan': {
        ed.setCamera({ x: s.cam.x + (screen.x - s.start.x) / s.cam.z, y: s.cam.y + (screen.y - s.start.y) / s.cam.z, z: s.cam.z })
        return
      }
      case 'pending': {
        if (dist(screen, s.start) < DRAG_PX) return
        const canMove = s.part === 'body' || s.part === 'label' || s.part === 'selection' || (s.part === 'interior' && s.hitId && ed.getSelectedIds().includes(s.hitId))
        if (canMove && !(s.shift && s.part === 'body' && !ed.getSelectedIds().includes(s.hitId!))) {
          const ids = ed.getSelectedIds()
          const all = ed.withChildren(ids)
          ed.beginInteraction()
          this.setState({ t: 'translate', startPage: s.startPage, ids, initial: new Map(all.map((id) => [id, { x: ed.getShape(id)!.x, y: ed.getShape(id)!.y }])), last: page })
        } else {
          this.setState({ t: 'brush', startPage: s.startPage, base: s.shift ? ed.getSelectedIds() : [] })
        }
        return this.onMove(e)
      }
      case 'translate': {
        let d = sub(page, s.startPage)
        if (e.shiftKey) d = Math.abs(d.x) > Math.abs(d.y) ? { x: d.x, y: 0 } : { x: 0, y: d.y }
        ed.updateShapes([...s.initial].map(([id, p]) => ({ id, x: p.x + d.x, y: p.y + d.y })))
        // Highlight the frame we'd drop into.
        const moving = new Set(s.initial.keys())
        const anyNonFrame = s.ids.some((id) => ed.getShape(id)?.type !== 'frame')
        const target = anyNonFrame ? ed.frameAt(page, moving) : undefined
        if (ed.ui.get().dropTargetId !== (target?.id ?? null)) ed.ui.update({ dropTargetId: target?.id ?? null })
        return
      }
      case 'brush': {
        const box = boxFromPoints(s.startPage, page)
        const hits = ed.getShapesInBox(box).map((x) => x.id)
        ed.ui.update({ brush: box, selectedIds: [...new Set([...s.base, ...hits])] })
        return
      }
      case 'resize':
        return this.applyResize(s, page, e.shiftKey)
      case 'rotate': {
        let delta = angleOf(s.center, page) - s.startAngle
        if (e.shiftKey) {
          const first = [...s.initial.values()][0]
          delta = snapAngle(first.rotation + delta) - first.rotation
        }
        ed.updateShapes([...s.initial.values()].map((sh) => ({ id: sh.id, ...rotateAround(sh, s.center, delta) })))
        return
      }
      case 'draw': {
        const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e]
        for (const ev of events.length ? events : [e]) {
          const p = ed.screenToPage(this.screen(ev))
          s.points.push(p.x, p.y, ev.pointerType === 'pen' ? ev.pressure || 0.5 : 0.5)
        }
        ed.ui.update({ drawing: [...s.points] })
        return
      }
      case 'frame':
        ed.ui.update({ creating: boxFromPoints(s.startPage, page) })
        return
    }
  }

  private applyResize(s: Extract<State, { t: 'resize' }>, page: Vec, shift: boolean) {
    const ed = this.editor
    const shapes = [...s.initial.values()]
    const patches: ShapePatch[] = []
    if (shapes.length === 1) {
      const sh = shapes[0]
      const minSize = sh.type === 'draw' ? 4 : sh.type === 'card' ? 120 : 40
      const r = resizeBox(sh, s.handle, page, { keepAspect: shift, minW: minSize, minH: sh.type === 'card' ? 60 : minSize })
      patches.push({ id: sh.id, ...r, ...scaledPoints(sh, r.w, r.h) })
    } else {
      // Uniform scale around the opposite side of the selection box.
      const a = HANDLE_ANCHOR[s.handle]
      const anchor = { x: s.box.x + s.box.w * (1 - a.x), y: s.box.y + s.box.h * (1 - a.y) }
      const from = { x: s.box.x + s.box.w * a.x, y: s.box.y + s.box.h * a.y }
      const sx = a.x === 0.5 ? null : (page.x - anchor.x) / (from.x - anchor.x || 1)
      const sy = a.y === 0.5 ? null : (page.y - anchor.y) / (from.y - anchor.y || 1)
      const k = Math.max(0.05, sx == null ? sy! : sy == null ? sx : Math.max(sx, sy))
      for (const sh of shapes) {
        const c = shapeCenter(sh)
        const nc = { x: anchor.x + (c.x - anchor.x) * k, y: anchor.y + (c.y - anchor.y) * k }
        const w = sh.w * k
        const h = sh.h * k
        patches.push({ id: sh.id, x: nc.x - w / 2, y: nc.y - h / 2, w, h, ...scaledPoints(sh, w, h) })
      }
    }
    ed.updateShapes(patches)
  }

  /* ---------------------------------- Up ---------------------------------- */

  private onUp = (e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      this.touches.delete(e.pointerId)
      if (this.state.t === 'pinch') {
        if (this.touches.size < 2) {
          this.pinchStart = null
          this.setState({ t: 'idle' })
        }
        return
      }
    }
    const ed = this.editor
    const s = this.state
    this.root.releasePointerCapture?.(e.pointerId)
    switch (s.t) {
      case 'pending': {
        if (s.selectOnUp) ed.select([s.selectOnUp])
        else if (s.part === 'interior' && s.hitId && !s.shift) ed.select([s.hitId])
        break
      }
      case 'translate': {
        const moved = [...s.initial.keys()]
        const frames = s.ids.filter((id) => ed.getShape(id)?.type === 'frame')
        ed.reparent(s.ids.filter((id) => !frames.includes(id) && !frames.includes(ed.getShape(id)?.parentId ?? '')))
        for (const f of frames) ed.refreshFrameMembership(f)
        ed.ui.update({ dropTargetId: null })
        ed.endInteraction()
        void moved
        break
      }
      case 'brush':
        ed.ui.update({ brush: null })
        break
      case 'resize': {
        for (const id of s.initial.keys()) if (ed.getShape(id)?.type === 'frame') ed.refreshFrameMembership(id)
        ed.endInteraction()
        break
      }
      case 'rotate':
        ed.endInteraction()
        break
      case 'draw':
        this.finishStroke(s.points)
        break
      case 'frame':
        this.finishFrame(s.startPage, ed.screenToPage(this.screen(e)))
        break
    }
    this.setState({ t: 'idle' })
  }

  private finishStroke(points: number[]) {
    const ed = this.editor
    ed.ui.update({ drawing: null })
    if (points.length < 3) return
    const size = ed.ui.get().inkSize
    const b = pointsBounds(points)
    const pad = size
    const x = b.x - pad
    const y = b.y - pad
    const local: number[] = []
    for (let i = 0; i < points.length; i += 3) local.push(points[i] - x, points[i + 1] - y, points[i + 2])
    const id = ed.createShape({ type: 'draw', x, y, w: b.w + pad * 2, h: b.h + pad * 2, points: local })
    ed.reparent([id])
  }

  private finishFrame(a: Vec, b: Vec) {
    const ed = this.editor
    ed.ui.update({ creating: null })
    let box = boxFromPoints(a, b)
    if (box.w * ed.getCamera().z < 10 || box.h * ed.getCamera().z < 10) box = { x: a.x - 240, y: a.y - 160, w: 480, h: 320 }
    const n = ed.getShapes().filter((s) => s.type === 'frame').length + 1
    ed.run(() => {
      const id = ed.createShape({ type: 'frame', name: `Frame ${n}`, ...box })
      ed.sendToBack([id])
      ed.refreshFrameMembership(id)
      ed.setTool('select')
      ed.select([id])
    })
  }

  private cancelCurrent() {
    const ed = this.editor
    const s = this.state
    if (s.t === 'translate' || s.t === 'resize' || s.t === 'rotate') ed.endInteraction(true)
    ed.ui.update({ brush: null, drawing: null, creating: null, dropTargetId: null })
    this.setState({ t: 'idle' })
  }

  private onCancel = (e: PointerEvent) => {
    this.touches.delete(e.pointerId)
    this.cancelCurrent()
  }

  /* ------------------------------ Wheel & keys ----------------------------- */

  private onWheel = (e: WheelEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-canvas]')) return
    e.preventDefault()
    this.rect = this.root.getBoundingClientRect()
    const ed = this.editor
    const screen = this.screen(e)
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
    const dx = e.deltaX * unit
    const dy = e.deltaY * unit
    // Pinch on trackpads arrives as ctrl+wheel. A classic mouse wheel sends line deltas or
    // big integer steps with no horizontal component: treat that as zoom too.
    const isMouseWheel = e.deltaMode === 1 || (dx === 0 && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 50)
    if (e.ctrlKey || e.metaKey || (isMouseWheel && !e.shiftKey)) {
      const factor = Math.exp(-dy * (e.ctrlKey && !isMouseWheel ? 0.01 : 0.0015))
      ed.zoomAtScreen(screen, ed.getCamera().z * factor)
      return
    }
    ed.panBy(e.shiftKey && !dx ? { x: -dy, y: 0 } : { x: -dx, y: -dy })
  }

  private onDoubleClick = (e: MouseEvent) => {
    if (isEditableTarget(e.target)) return
    this.rect = this.root.getBoundingClientRect()
    const ed = this.editor
    const label = (e.target as HTMLElement).closest<HTMLElement>('[data-frame-label]')
    if (label) return ed.setEditing(label.dataset.frameLabel!)
    if (ed.ui.get().tool !== 'select') return
    const hit = ed.getShapeAt(ed.screenToPage(this.screen(e)), 3 / ed.getCamera().z)
    if (!hit) return
    if (hit.shape.type === 'card') this.cb.onOpenCard(hit.shape.id)
    else if (hit.shape.type === 'note') ed.setEditing(hit.shape.id)
    else if (hit.shape.type === 'frame') ed.setEditing(hit.shape.id)
  }

  private onContextMenu = (e: MouseEvent) => {
    if (isEditableTarget(e.target) || (e.target as HTMLElement).closest('[data-no-canvas]')) return
    e.preventDefault()
    this.rect = this.root.getBoundingClientRect()
    const ed = this.editor
    const screen = this.screen(e)
    const label = (e.target as HTMLElement).closest<HTMLElement>('[data-frame-label]')
    const hitId = label?.dataset.frameLabel ?? ed.getShapeAt(ed.screenToPage(screen), 3 / ed.getCamera().z)?.shape.id
    if (hitId && !ed.getSelectedIds().includes(hitId)) ed.select([hitId])
    if (!hitId) {
      const box = ed.getSelectionBounds()
      if (!box || !boxContainsPoint(box, ed.screenToPage(screen))) ed.selectNone()
    }
    this.cb.onContextMenu(screen, { x: e.clientX, y: e.clientY })
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (isEditableTarget(e.target)) return
    if (e.code === 'Space' && !e.repeat) {
      if (!this.editor.ui.get().spaceHeld) this.editor.ui.update({ spaceHeld: true })
      e.preventDefault()
    }
    if (e.key === 'Escape' && this.state.t !== 'idle') {
      this.cancelCurrent()
      e.stopImmediatePropagation()
    }
  }

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') this.editor.ui.update({ spaceHeld: false })
  }

  private onBlur = () => {
    this.editor.ui.update({ spaceHeld: false })
  }
}

function prevent(e: Event) {
  e.preventDefault()
}

/** Scale a drawing's points when its box is resized. */
function scaledPoints(sh: Shape, w: number, h: number): { points?: number[] } {
  if (sh.type !== 'draw') return {}
  const sx = w / sh.w
  const sy = h / sh.h
  const points = sh.points.slice()
  for (let i = 0; i < points.length; i += 3) {
    points[i] *= sx
    points[i + 1] *= sy
  }
  return { points }
}
