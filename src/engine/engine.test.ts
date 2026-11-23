import { describe, expect, it } from 'vitest'
import { Editor } from './Editor'
import { hitShape, resizeBox, screenToPage, pageToScreen, shapeBounds, zoomAt, cameraForBox } from './geometry'

const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-6)

describe('geometry', () => {
  it('camera round-trips and zoomAt keeps the anchor fixed', () => {
    const c = { x: 30, y: -20, z: 1.5 }
    const p = screenToPage({ x: 200, y: 100 }, c)
    const s = pageToScreen(p, c)
    near(s.x, 200); near(s.y, 100)
    const c2 = zoomAt(c, { x: 200, y: 100 }, 3)
    const p2 = screenToPage({ x: 200, y: 100 }, c2)
    near(p2.x, p.x); near(p2.y, p.y)
  })
  it('fits a box in the viewport', () => {
    const c = cameraForBox({ x: 0, y: 0, w: 1000, h: 500 }, { w: 600, h: 400 }, 50)
    near(c.z, 0.5)
    const center = screenToPage({ x: 300, y: 200 }, c)
    near(center.x, 500); near(center.y, 250)
  })
  it('hit-tests rotated boxes', () => {
    const s = { id: 'a', type: 'card', x: 0, y: 0, w: 100, h: 20, rotation: Math.PI / 2 } as never
    expect(hitShape({ x: 50, y: -30 }, s)).toBe(true) // rotated vertical
    expect(hitShape({ x: 5, y: 10 }, s)).toBe(false)
    const b = shapeBounds(s)
    near(b.x, 40); near(b.w, 20); near(b.h, 100)
  })
  it('resizes from a corner keeping the opposite corner fixed', () => {
    const r = resizeBox({ x: 0, y: 0, w: 100, h: 100, rotation: 0 }, 'se', { x: 150, y: 120 })
    expect(r).toEqual({ x: 0, y: 0, w: 150, h: 120 })
    const l = resizeBox({ x: 0, y: 0, w: 100, h: 100, rotation: 0 }, 'nw', { x: 20, y: 30 })
    expect(l).toEqual({ x: 20, y: 30, w: 80, h: 70 })
    const a = resizeBox({ x: 0, y: 0, w: 200, h: 100, rotation: 0 }, 'e', { x: 300, y: 50 }, { keepAspect: true })
    expect(a).toEqual({ x: 0, y: -25, w: 300, h: 150 })
  })
  it('resizes rotated boxes around the fixed corner', () => {
    const init = { x: 0, y: 0, w: 100, h: 50, rotation: Math.PI / 2 }
    // For a 90deg rotation, local +x points to page +y. Dragging the "e" handle further down grows w.
    const r = resizeBox(init, 'e', { x: 50, y: 125 })
    near(r.w, 150); near(r.h, 50)
    // the "w" edge (local x=0) stays at page y = -25
    const centerY = r.y + r.h / 2
    near(centerY - r.w / 2, -25)
  })
})

describe('Editor', () => {
  it('undo/redo groups transactions', () => {
    const e = new Editor()
    const id = e.createShape({ type: 'card', x: 0, y: 0 })
    e.run(() => {
      e.updateShape({ id, x: 10 })
      e.updateShape({ id, x: 20 })
    })
    expect(e.getShape(id)!.x).toBe(20)
    e.undo()
    expect(e.getShape(id)!.x).toBe(0)
    e.undo()
    expect(e.getShape(id)).toBeUndefined()
    e.redo(); e.redo()
    expect(e.getShape(id)!.x).toBe(20)
  })
  it('cancelled interactions restore the doc', () => {
    const e = new Editor()
    const id = e.createShape({ type: 'note', x: 0, y: 0 })
    e.beginInteraction()
    e.translate([id], { x: 50, y: 50 })
    e.endInteraction(true)
    expect(e.getShape(id)!.x).toBe(0)
    expect(e.history.get().canUndo).toBe(true) // only the create
  })
  it('frames carry children, delete cascades, unframe keeps them', () => {
    const e = new Editor()
    const a = e.createShape({ type: 'card', x: 0, y: 0, w: 100, h: 100 })
    const b = e.createShape({ type: 'card', x: 200, y: 0, w: 100, h: 100 })
    const f = e.frameShapes([a, b], 'Auth')!
    expect(e.getChildren(f).map((s) => s.id).sort()).toEqual([a, b].sort())
    expect(e.getRenderOrder()[0].id).toBe(f)
    e.translate([f], { x: 10, y: 5 })
    expect(e.getShape(a)!.x).toBe(10)
    expect(e.getShape(b)!.y).toBe(5)
    e.unframe([f])
    expect(e.getShape(f)).toBeUndefined()
    expect(e.getShape(a)!.parentId).toBeNull()
    e.undo()
    e.deleteShapes([f])
    expect(e.getShapes()).toHaveLength(0)
  })
  it('reparents by center and hit-tests children before frames', () => {
    const e = new Editor()
    const f = e.createShape({ type: 'frame', x: 0, y: 0, w: 500, h: 500 })
    const c = e.createShape({ type: 'card', x: 600, y: 0, w: 100, h: 100 })
    e.translate([c], { x: -500, y: 100 })
    e.reparent([c])
    expect(e.getShape(c)!.parentId).toBe(f)
    expect(e.getShapeAt({ x: 150, y: 150 })?.shape.id).toBe(c)
    expect(e.getShapeAt({ x: 400, y: 400 })).toMatchObject({ part: 'interior' })
    expect(e.getShapeAt({ x: 900, y: 900 })).toBeNull()
  })
  it('duplicates frames with their contents', () => {
    const e = new Editor()
    const a = e.createShape({ type: 'card', x: 0, y: 0, w: 100, h: 100 })
    const f = e.frameShapes([a], 'F')!
    const [f2] = e.duplicate([f])
    expect(e.getChildren(f2)).toHaveLength(1)
    expect(e.getShapes()).toHaveLength(4)
  })
  it('marquee selects touched shapes but only enclosed frames', () => {
    const e = new Editor()
    e.createShape({ type: 'frame', x: 0, y: 0, w: 500, h: 500 })
    const c = e.createShape({ type: 'card', x: 50, y: 50, w: 100, h: 100 })
    expect(e.getShapesInBox({ x: 100, y: 100, w: 10, h: 10 }).map((s) => s.id)).toEqual([c])
    expect(e.getShapesInBox({ x: -10, y: -10, w: 600, h: 600 })).toHaveLength(2)
  })
  it('reorders z-index', () => {
    const e = new Editor()
    const [a, b, c] = e.createShapes([{ type: 'note' }, { type: 'note' }, { type: 'note' }])
    e.bringToFront([a])
    expect(e.doc.get().order).toEqual([b, c, a])
    e.sendBackward([a])
    expect(e.doc.get().order).toEqual([b, a, c])
  })
})

