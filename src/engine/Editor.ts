import {
  boxCenter,
  boxContainsBox,
  boxContainsPoint,
  boxIntersects,
  boxUnion,
  cameraForBox,
  clampZoom,
  hitShape,
  pageToScreen,
  screenToPage,
  shapeBounds,
  shapeCenter,
  viewportPageBox,
  zoomAt,
} from './geometry'
import { Store } from './store'
import {
  emptyDoc,
  type AssetMeta,
  type Box,
  type Camera,
  type ChatSession,
  type Doc,
  type InkColor,
  type NoteColor,
  type Shape,
  type ShapePatch,
  type ShapeType,
  type Theme,
  type Tool,
  type Vec,
} from './types'

export interface UiState {
  camera: Camera
  viewport: { w: number; h: number }
  selectedIds: string[]
  tool: Tool
  /** Note or frame whose text is being edited inline. */
  editingId: string | null
  brush: Box | null
  /** Frame highlighted as the drop target while dragging. */
  dropTargetId: string | null
  /** Live preview while dragging out a new frame. */
  creating: Box | null
  /** Live stroke (page space, flat x,y,p) while drawing. */
  drawing: number[] | null
  spaceHeld: boolean
  isDragging: boolean
  theme: Theme
  inkColor: InkColor
  inkSize: number
  noteColor: NoteColor
}

export type NewShape = Partial<Shape> & { type: ShapeType }

const HISTORY_LIMIT = 200

export function uid(prefix: string) {
  const r = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now().toString(36)}${r}`
}

function defaultsFor(type: ShapeType, ui: UiState): Partial<Shape> {
  switch (type) {
    case 'card':
      return { w: 320, h: 200, assetId: null, title: '', text: '', isCode: false, language: '' }
    case 'note':
      return { w: 200, h: 200, text: '', color: ui.noteColor }
    case 'frame':
      return { w: 480, h: 320, name: 'Frame' }
    case 'draw':
      return { w: 1, h: 1, points: [], color: ui.inkColor, size: ui.inkSize }
  }
}

const raf: (cb: (t: number) => void) => number =
  typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : (cb) => (setTimeout(() => cb(Date.now()), 16) as unknown as number)

export class Editor {
  readonly doc = new Store<Doc>(emptyDoc())
  readonly ui: Store<UiState>
  readonly history = new Store({ canUndo: false, canRedo: false })

  private undoStack: Doc[] = []
  private redoStack: Doc[] = []
  private tx = 0
  private txBefore: Doc | null = null
  private cameraAnim = 0

  constructor(opts: { theme?: Theme; camera?: Camera } = {}) {
    this.ui = new Store<UiState>({
      camera: opts.camera ?? { x: 0, y: 0, z: 1 },
      viewport: { w: 1200, h: 800 },
      selectedIds: [],
      tool: 'select',
      editingId: null,
      brush: null,
      dropTargetId: null,
      creating: null,
      drawing: null,
      spaceHeld: false,
      isDragging: false,
      theme: opts.theme ?? 'dark',
      inkColor: 'default',
      inkSize: 4,
      noteColor: 'yellow',
    })
  }

  /* -------------------------------- History -------------------------------- */

  private syncHistory() {
    this.history.set({ canUndo: this.undoStack.length > 0, canRedo: this.redoStack.length > 0 })
  }

  private pushUndo(prev: Doc) {
    this.undoStack.push(prev)
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift()
    this.redoStack = []
    this.syncHistory()
  }

  private commit(next: Doc) {
    const prev = this.doc.get()
    if (next === prev) return
    if (this.tx === 0) this.pushUndo(prev)
    this.doc.set(next)
  }

  /** Group several changes into one undo step. */
  run<T>(fn: () => T): T {
    this.beginInteraction()
    try {
      return fn()
    } finally {
      this.endInteraction()
    }
  }

  /** Start a long interaction (a drag): every change until `endInteraction` is one undo step. */
  beginInteraction() {
    if (this.tx === 0) this.txBefore = this.doc.get()
    this.tx++
  }

  endInteraction(cancel = false) {
    if (this.tx === 0) return
    this.tx--
    if (this.tx > 0) return
    const before = this.txBefore!
    this.txBefore = null
    if (cancel) this.doc.set(before)
    else if (before !== this.doc.get()) this.pushUndo(before)
  }

  undo() {
    if (this.tx > 0) return
    const prev = this.undoStack.pop()
    if (!prev) return
    this.redoStack.push(this.doc.get())
    this.doc.set(prev)
    this.syncHistory()
    this.pruneSelection()
  }

  redo() {
    if (this.tx > 0) return
    const next = this.redoStack.pop()
    if (!next) return
    this.undoStack.push(this.doc.get())
    this.doc.set(next)
    this.syncHistory()
    this.pruneSelection()
  }

  /** Replace the whole document (load/import). */
  loadDoc(doc: Doc, opts: { keepHistory?: boolean } = {}) {
    if (opts.keepHistory) this.commit(doc)
    else {
      this.undoStack = []
      this.redoStack = []
      this.doc.set(doc)
      this.syncHistory()
    }
    this.ui.update({ selectedIds: [], editingId: null })
  }

  /* -------------------------------- Queries -------------------------------- */

  private orderCache: { doc: Doc; shapes: Shape[]; render: Shape[] } | null = null

  private ordered() {
    const doc = this.doc.get()
    if (this.orderCache?.doc !== doc) {
      const shapes = doc.order.map((id) => doc.shapes[id]).filter(Boolean)
      const render = [...shapes.filter((s) => s.type === 'frame'), ...shapes.filter((s) => s.type !== 'frame')]
      this.orderCache = { doc, shapes, render }
    }
    return this.orderCache
  }

  getShape = (id: string | null | undefined): Shape | undefined => (id ? this.doc.get().shapes[id] : undefined)
  /** All shapes in z-order (back to front). */
  getShapes = (): Shape[] => this.ordered().shapes
  /** Paint order: frames first, then everything else. */
  getRenderOrder = (): Shape[] => this.ordered().render
  getSelectedIds = () => this.ui.get().selectedIds
  getSelectedShapes = () => this.getSelectedIds().map((id) => this.getShape(id)).filter((s): s is Shape => !!s)
  getOnlySelected = () => {
    const ids = this.getSelectedIds()
    return ids.length === 1 ? this.getShape(ids[0]) : undefined
  }
  getChildren = (frameId: string) => this.getShapes().filter((s) => s.parentId === frameId)

  getBounds = (id: string): Box | null => {
    const s = this.getShape(id)
    return s ? shapeBounds(s) : null
  }

  getBoundsOf = (ids: string[]): Box | null => boxUnion(ids.map((id) => this.getBounds(id)).filter((b): b is Box => !!b))
  getSelectionBounds = () => this.getBoundsOf(this.getSelectedIds())
  getContentBounds = () => this.getBoundsOf(this.doc.get().order)

  /** Ids plus the children of any frames among them. */
  withChildren(ids: string[]): string[] {
    const out = new Set(ids)
    for (const id of ids) {
      const s = this.getShape(id)
      if (s?.type === 'frame') for (const c of this.getChildren(id)) out.add(c.id)
    }
    return [...out]
  }

  /**
   * Topmost shape under a page point. Non-frame shapes win over frames.
   * `part` is 'interior' when the hit is a frame's empty area.
   */
  getShapeAt(p: Vec, tol = 0): { shape: Shape; part: 'body' | 'interior' } | null {
    const shapes = this.getRenderOrder()
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i]
      if (s.type !== 'frame' && hitShape(p, s, tol)) return { shape: s, part: 'body' }
    }
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i]
      if (s.type === 'frame' && hitShape(p, s, tol)) return { shape: s, part: 'interior' }
    }
    return null
  }

  /** Shapes for a marquee: anything touched, except frames, which must be fully enclosed. */
  getShapesInBox(box: Box): Shape[] {
    return this.getShapes().filter((s) => {
      const b = shapeBounds(s)
      return s.type === 'frame' ? boxContainsBox(box, b) : boxIntersects(box, b)
    })
  }

  /** Topmost frame containing the page point, ignoring `exclude`. */
  frameAt(p: Vec, exclude: Set<string> = new Set()): Shape | undefined {
    const frames = this.getShapes().filter((s) => s.type === 'frame' && !exclude.has(s.id))
    for (let i = frames.length - 1; i >= 0; i--) if (boxContainsPoint(shapeBounds(frames[i]), p)) return frames[i]
    return undefined
  }

  /* ------------------------------- Mutations ------------------------------- */

  createShapes(partials: NewShape[]): string[] {
    const doc = this.doc.get()
    const shapes = { ...doc.shapes }
    const order = [...doc.order]
    const ui = this.ui.get()
    const ids: string[] = []
    for (const p of partials) {
      const id = p.id ?? uid(p.type)
      const shape = {
        x: 0,
        y: 0,
        rotation: 0,
        parentId: null,
        createdAt: Date.now(),
        tags: [],
        sessionId: '',
        ...defaultsFor(p.type, ui),
        ...p,
        id,
      } as Shape
      shapes[id] = shape
      if (!order.includes(id)) order.push(id)
      ids.push(id)
    }
    this.commit({ ...doc, shapes, order })
    return ids
  }

  createShape(partial: NewShape): string {
    return this.createShapes([partial])[0]
  }

  updateShapes(patches: ShapePatch[]) {
    const doc = this.doc.get()
    let shapes: Record<string, Shape> | null = null
    for (const p of patches) {
      const s = (shapes ?? doc.shapes)[p.id]
      if (!s) continue
      let changed = false
      for (const k in p) if ((s as unknown as Record<string, unknown>)[k] !== (p as Record<string, unknown>)[k]) changed = true
      if (!changed) continue
      shapes ??= { ...doc.shapes }
      shapes[p.id] = { ...s, ...p, id: s.id, type: s.type } as Shape
    }
    if (shapes) this.commit({ ...doc, shapes })
  }

  updateShape(patch: ShapePatch) {
    this.updateShapes([patch])
  }

  /** Delete shapes; deleting a frame deletes what's inside it. */
  deleteShapes(ids: string[]) {
    const all = new Set(this.withChildren(ids))
    if (!all.size) return
    const doc = this.doc.get()
    const shapes = { ...doc.shapes }
    for (const id of all) delete shapes[id]
    this.commit({ ...doc, shapes, order: doc.order.filter((id) => !all.has(id)) })
    this.ui.update({
      selectedIds: this.getSelectedIds().filter((id) => !all.has(id)),
      editingId: all.has(this.ui.get().editingId ?? '') ? null : this.ui.get().editingId,
    })
  }

  translate(ids: string[], delta: Vec) {
    if (!delta.x && !delta.y) return
    this.updateShapes(
      this.withChildren(ids).map((id) => {
        const s = this.getShape(id)!
        return { id, x: s.x + delta.x, y: s.y + delta.y }
      })
    )
  }

  /** Re-evaluate which frame each shape belongs to, based on its center. */
  reparent(ids: string[]) {
    const patches: ShapePatch[] = []
    for (const id of ids) {
      const s = this.getShape(id)
      if (!s || s.type === 'frame') continue
      const frame = this.frameAt(shapeCenter(s), new Set([id]))
      const parentId = frame?.id ?? null
      if (parentId !== s.parentId) patches.push({ id, parentId })
    }
    if (patches.length) this.updateShapes(patches)
  }

  /** After a frame moves/resizes/is created: adopt shapes inside it, release shapes outside it. */
  refreshFrameMembership(frameId: string) {
    const frame = this.getShape(frameId)
    if (!frame || frame.type !== 'frame') return
    const fb = shapeBounds(frame)
    const patches: ShapePatch[] = []
    for (const s of this.getShapes()) {
      if (s.type === 'frame') continue
      const inside = boxContainsPoint(fb, shapeCenter(s))
      if (s.parentId === frameId && !inside) patches.push({ id: s.id, parentId: this.frameAt(shapeCenter(s), new Set([frameId]))?.id ?? null })
      else if (s.parentId !== frameId && inside && !s.parentId) patches.push({ id: s.id, parentId: frameId })
    }
    if (patches.length) this.updateShapes(patches)
  }

  private reorder(ids: string[], mode: 'front' | 'back' | 'forward' | 'backward') {
    const set = new Set(this.withChildren(ids))
    const doc = this.doc.get()
    let order = [...doc.order]
    if (mode === 'front') order = [...order.filter((id) => !set.has(id)), ...order.filter((id) => set.has(id))]
    else if (mode === 'back') order = [...order.filter((id) => set.has(id)), ...order.filter((id) => !set.has(id))]
    else if (mode === 'forward') {
      for (let i = order.length - 2; i >= 0; i--)
        if (set.has(order[i]) && !set.has(order[i + 1])) [order[i], order[i + 1]] = [order[i + 1], order[i]]
    } else {
      for (let i = 1; i < order.length; i++) if (set.has(order[i]) && !set.has(order[i - 1])) [order[i], order[i - 1]] = [order[i - 1], order[i]]
    }
    this.commit({ ...doc, order })
  }
  bringToFront = (ids: string[]) => this.reorder(ids, 'front')
  sendToBack = (ids: string[]) => this.reorder(ids, 'back')
  bringForward = (ids: string[]) => this.reorder(ids, 'forward')
  sendBackward = (ids: string[]) => this.reorder(ids, 'backward')

  /** Clone shapes (and frame contents) with an offset. Returns the new top-level ids. */
  duplicate(ids: string[], offset: Vec = { x: 24, y: 24 }): string[] {
    const all = this.withChildren(ids)
    const map = new Map(all.map((id) => [id, uid(this.getShape(id)!.type)]))
    const order = this.doc.get().order.filter((id) => map.has(id))
    const clones = order.map((id) => {
      const s = this.getShape(id)!
      return {
        ...structuredClone(s),
        id: map.get(id)!,
        x: s.x + offset.x,
        y: s.y + offset.y,
        parentId: s.parentId && map.has(s.parentId) ? map.get(s.parentId)! : s.parentId,
        createdAt: Date.now(),
      }
    })
    this.createShapes(clones)
    return ids.filter((id) => map.has(id)).map((id) => map.get(id)!)
  }

  /** Wrap shapes in a new frame sized to fit them. */
  frameShapes(ids: string[], name: string, padding = 48): string | null {
    const targets = ids.filter((id) => this.getShape(id)?.type !== 'frame')
    const b = this.getBoundsOf(targets)
    if (!b) return null
    return this.run(() => {
      const frameId = this.createShape({
        type: 'frame',
        name,
        x: b.x - padding,
        y: b.y - padding,
        w: b.w + padding * 2,
        h: b.h + padding * 2,
      })
      this.updateShapes(targets.map((id) => ({ id, parentId: frameId })))
      this.sendToBack([frameId])
      return frameId
    })
  }

  /** Remove frames but keep their contents. */
  unframe(frameIds: string[]) {
    const frames = frameIds.filter((id) => this.getShape(id)?.type === 'frame')
    if (!frames.length) return
    this.run(() => {
      const kids = frames.flatMap((f) => this.getChildren(f).map((c) => c.id))
      this.updateShapes(kids.map((id) => ({ id, parentId: null })))
      const doc = this.doc.get()
      const shapes = { ...doc.shapes }
      for (const f of frames) delete shapes[f]
      this.commit({ ...doc, shapes, order: doc.order.filter((id) => !frames.includes(id)) })
      this.select(kids)
    })
  }

  addAsset(meta: AssetMeta) {
    const doc = this.doc.get()
    this.commit({ ...doc, assets: { ...doc.assets, [meta.id]: meta } })
  }

  setSessions(fn: (sessions: ChatSession[]) => ChatSession[]) {
    const doc = this.doc.get()
    this.commit({ ...doc, sessions: fn(doc.sessions) })
  }

  /** Tween shapes to new positions; one undo step. */
  animateShapes(patches: { id: string; x: number; y: number }[], duration = 260) {
    const start = new Map(patches.map((p) => [p.id, { x: this.getShape(p.id)?.x ?? p.x, y: this.getShape(p.id)?.y ?? p.y }]))
    if (typeof requestAnimationFrame === 'undefined' || duration <= 0) return this.updateShapes(patches)
    this.beginInteraction()
    const t0 = performance.now()
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / duration)
      const e = 1 - Math.pow(1 - k, 3)
      this.updateShapes(
        patches.map((p) => {
          const s = start.get(p.id)!
          return { id: p.id, x: s.x + (p.x - s.x) * e, y: s.y + (p.y - s.y) * e }
        })
      )
      if (k < 1) raf(step)
      else this.endInteraction()
    }
    raf(step)
  }

  /* ------------------------------- Selection ------------------------------- */

  select(ids: string[]) {
    this.ui.update({ selectedIds: [...new Set(ids)].filter((id) => this.getShape(id)), editingId: null })
  }
  addToSelection(ids: string[]) {
    this.select([...this.getSelectedIds(), ...ids])
  }
  toggleSelection(id: string) {
    const sel = this.getSelectedIds()
    this.select(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id])
  }
  selectAll() {
    this.select(this.getShapes().map((s) => s.id))
  }
  selectNone() {
    if (this.getSelectedIds().length || this.ui.get().editingId) this.ui.update({ selectedIds: [], editingId: null })
  }
  private pruneSelection() {
    const doc = this.doc.get()
    const sel = this.getSelectedIds().filter((id) => doc.shapes[id])
    if (sel.length !== this.getSelectedIds().length) this.ui.update({ selectedIds: sel })
  }

  setTool(tool: Tool) {
    this.ui.update({ tool, editingId: null })
    if (tool !== 'select') this.selectNone()
  }

  setEditing(id: string | null) {
    this.ui.update({ editingId: id, selectedIds: id ? [id] : this.getSelectedIds() })
  }

  /* -------------------------------- Camera -------------------------------- */

  getCamera = () => this.ui.get().camera
  screenToPage = (p: Vec) => screenToPage(p, this.getCamera())
  pageToScreen = (p: Vec) => pageToScreen(p, this.getCamera())
  getViewportPageBox = () => viewportPageBox(this.getCamera(), this.ui.get().viewport)
  getViewportCenter = (): Vec => boxCenter(this.getViewportPageBox())

  setViewport(w: number, h: number) {
    const v = this.ui.get().viewport
    if (v.w !== w || v.h !== h) this.ui.update({ viewport: { w, h } })
  }

  setCamera(camera: Camera, opts: { animate?: boolean } = {}) {
    cancelAnimationFrameSafe(this.cameraAnim)
    const next = { ...camera, z: clampZoom(camera.z) }
    if (!opts.animate || typeof requestAnimationFrame === 'undefined') return this.ui.update({ camera: next })
    const from = this.getCamera()
    const t0 = performance.now()
    const dur = 320
    // Interpolate in screen-center space so the motion looks straight.
    const v = this.ui.get().viewport
    const cFrom = screenToPage({ x: v.w / 2, y: v.h / 2 }, from)
    const cTo = screenToPage({ x: v.w / 2, y: v.h / 2 }, next)
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur)
      const e = 1 - Math.pow(1 - k, 3)
      const z = from.z * Math.pow(next.z / from.z, e)
      const cx = cFrom.x + (cTo.x - cFrom.x) * e
      const cy = cFrom.y + (cTo.y - cFrom.y) * e
      this.ui.update({ camera: { x: v.w / 2 / z - cx, y: v.h / 2 / z - cy, z } })
      if (k < 1) this.cameraAnim = raf(step)
    }
    this.cameraAnim = raf(step)
  }

  panBy(screenDelta: Vec) {
    const c = this.getCamera()
    this.setCamera({ x: c.x + screenDelta.x / c.z, y: c.y + screenDelta.y / c.z, z: c.z })
  }

  zoomAtScreen(screen: Vec, z: number) {
    this.setCamera(zoomAt(this.getCamera(), screen, z))
  }

  private zoomStep(dir: 1 | -1) {
    const v = this.ui.get().viewport
    const steps = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 8]
    const z = this.getCamera().z
    const next = dir > 0 ? steps.find((s) => s > z + 0.001) ?? 8 : [...steps].reverse().find((s) => s < z - 0.001) ?? 0.05
    this.setCamera(zoomAt(this.getCamera(), { x: v.w / 2, y: v.h / 2 }, next), { animate: true })
  }
  zoomIn = () => this.zoomStep(1)
  zoomOut = () => this.zoomStep(-1)
  resetZoom = () => {
    const v = this.ui.get().viewport
    this.setCamera(zoomAt(this.getCamera(), { x: v.w / 2, y: v.h / 2 }, 1), { animate: true })
  }

  zoomToBounds(box: Box, opts: { animate?: boolean; maxZoom?: number; padding?: number } = {}) {
    this.setCamera(cameraForBox(box, this.ui.get().viewport, opts.padding ?? 80, opts.maxZoom ?? 1), { animate: opts.animate ?? true })
  }
  zoomToFit = (animate = true) => {
    const b = this.getContentBounds()
    if (b) this.zoomToBounds(b, { animate })
    else this.setCamera({ x: this.ui.get().viewport.w / 2, y: this.ui.get().viewport.h / 2, z: 1 }, { animate })
  }
  zoomToSelection = () => {
    const b = this.getSelectionBounds()
    if (b) this.zoomToBounds(b, { maxZoom: Math.max(1, this.getCamera().z) })
  }
}

function cancelAnimationFrameSafe(id: number) {
  if (id && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(id)
}
