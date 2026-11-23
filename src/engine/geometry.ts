/** Pure 2D geometry for the engine. No DOM, fully unit tested. */
import type { Box, Camera, Shape, Vec } from './types'

export const vec = (x: number, y: number): Vec => ({ x, y })
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y })
export const mul = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s })
export const len = (a: Vec) => Math.hypot(a.x, a.y)
export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y)
export function rot(v: Vec, a: number): Vec {
  if (!a) return v
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c }
}

/* --------------------------------- Camera --------------------------------- */

export const screenToPage = (p: Vec, c: Camera): Vec => ({ x: p.x / c.z - c.x, y: p.y / c.z - c.y })
export const pageToScreen = (p: Vec, c: Camera): Vec => ({ x: (p.x + c.x) * c.z, y: (p.y + c.y) * c.z })

export const MIN_ZOOM = 0.05
export const MAX_ZOOM = 8
export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

/** Zoom to `z` while keeping the page point under `screen` fixed. */
export function zoomAt(c: Camera, screen: Vec, z: number): Camera {
  const nz = clampZoom(z)
  const p = screenToPage(screen, c)
  return { x: screen.x / nz - p.x, y: screen.y / nz - p.y, z: nz }
}

/** A camera that fits `box` inside a viewport of size `view`, with padding in screen px. */
export function cameraForBox(box: Box, view: { w: number; h: number }, padding = 64, maxZoom = 1): Camera {
  const w = Math.max(1, view.w - padding * 2)
  const h = Math.max(1, view.h - padding * 2)
  const z = clampZoom(Math.min(maxZoom, w / Math.max(1, box.w), h / Math.max(1, box.h)))
  return { x: view.w / 2 / z - (box.x + box.w / 2), y: view.h / 2 / z - (box.y + box.h / 2), z }
}

export function viewportPageBox(c: Camera, view: { w: number; h: number }): Box {
  return { x: -c.x, y: -c.y, w: view.w / c.z, h: view.h / c.z }
}

/* ---------------------------------- Boxes --------------------------------- */

export function boxFromPoints(a: Vec, b: Vec): Box {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) }
}

export function boxUnion(boxes: Box[]): Box | null {
  if (!boxes.length) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const b of boxes) {
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.w)
    maxY = Math.max(maxY, b.y + b.h)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export const boxIntersects = (a: Box, b: Box) => a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y
export const boxContainsBox = (outer: Box, inner: Box) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h
export const boxContainsPoint = (b: Box, p: Vec) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h
export const boxCenter = (b: Box): Vec => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })
export const expandBox = (b: Box, n: number): Box => ({ x: b.x - n, y: b.y - n, w: b.w + n * 2, h: b.h + n * 2 })

/* --------------------------------- Shapes --------------------------------- */

type Rect = Pick<Shape, 'x' | 'y' | 'w' | 'h' | 'rotation'>

export const shapeCenter = (s: Rect): Vec => ({ x: s.x + s.w / 2, y: s.y + s.h / 2 })

/** Page-space corners: top-left, top-right, bottom-right, bottom-left. */
export function shapeCorners(s: Rect): Vec[] {
  const c = shapeCenter(s)
  const hw = s.w / 2
  const hh = s.h / 2
  return [vec(-hw, -hh), vec(hw, -hh), vec(hw, hh), vec(-hw, hh)].map((p) => add(c, rot(p, s.rotation)))
}

/** Axis-aligned page bounds (accounts for rotation). */
export function shapeBounds(s: Rect): Box {
  if (!s.rotation) return { x: s.x, y: s.y, w: s.w, h: s.h }
  const pts = shapeCorners(s)
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

/** Page point -> the shape's local box space (0,0 = top-left of the unrotated box). */
export function toLocal(p: Vec, s: Rect): Vec {
  const c = shapeCenter(s)
  const l = rot(sub(p, c), -s.rotation)
  return { x: l.x + s.w / 2, y: l.y + s.h / 2 }
}

export function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const ab = sub(b, a)
  const l2 = ab.x * ab.x + ab.y * ab.y
  if (!l2) return dist(p, a)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2))
  return dist(p, add(a, mul(ab, t)))
}

/** Distance from a local point to a flat [x,y,p,...] polyline. */
export function distToPolyline(p: Vec, pts: number[]): number {
  if (pts.length < 3) return Infinity
  if (pts.length < 6) return dist(p, vec(pts[0], pts[1]))
  let d = Infinity
  for (let i = 3; i < pts.length; i += 3) {
    d = Math.min(d, distToSegment(p, vec(pts[i - 3], pts[i - 2]), vec(pts[i], pts[i + 1])))
  }
  return d
}

/** Is a page point on the shape? `tol` is in page units. */
export function hitShape(p: Vec, s: Shape, tol = 0): boolean {
  const l = toLocal(p, s)
  const inBox = l.x >= -tol && l.y >= -tol && l.x <= s.w + tol && l.y <= s.h + tol
  if (!inBox) return false
  if (s.type === 'draw') return distToPolyline(l, s.points) <= s.size / 2 + Math.max(tol, 4)
  return true
}

/** Is the page point on the outline of a box-ish shape (used for frames). */
export function hitShapeEdge(p: Vec, s: Rect, tol: number): boolean {
  const l = toLocal(p, s)
  const inOuter = l.x >= -tol && l.y >= -tol && l.x <= s.w + tol && l.y <= s.h + tol
  const inInner = l.x > tol && l.y > tol && l.x < s.w - tol && l.y < s.h - tol
  return inOuter && !inInner
}

/* --------------------------- Resizing & rotating --------------------------- */

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

/** Handle position in local box space as fractions of w/h. */
export const HANDLE_ANCHOR: Record<Handle, Vec> = {
  nw: vec(0, 0),
  n: vec(0.5, 0),
  ne: vec(1, 0),
  e: vec(1, 0.5),
  se: vec(1, 1),
  s: vec(0.5, 1),
  sw: vec(0, 1),
  w: vec(0, 0.5),
}

/**
 * Resize a (possibly rotated) box by dragging one handle to a page point.
 * The opposite edge/corner stays put. Returns the new x, y, w, h.
 */
export function resizeBox(
  initial: Rect,
  handle: Handle,
  pagePoint: Vec,
  opts: { keepAspect?: boolean; minW?: number; minH?: number } = {}
): { x: number; y: number; w: number; h: number } {
  const minW = opts.minW ?? 24
  const minH = opts.minH ?? 24
  const local = toLocal(pagePoint, initial)
  let l = 0
  let t = 0
  let r = initial.w
  let b = initial.h
  const movesX = handle.includes('e') ? 'r' : handle.includes('w') ? 'l' : null
  const movesY = handle.includes('s') ? 'b' : handle.includes('n') ? 't' : null
  if (movesX === 'r') r = Math.max(l + minW, local.x)
  if (movesX === 'l') l = Math.min(r - minW, local.x)
  if (movesY === 'b') b = Math.max(t + minH, local.y)
  if (movesY === 't') t = Math.min(b - minH, local.y)

  if (opts.keepAspect) {
    const aspect = initial.w / initial.h
    let w = r - l
    let h = b - t
    if (movesX && movesY) {
      if (w / h > aspect) h = w / aspect
      else w = h * aspect
    } else if (movesX) h = w / aspect
    else w = h * aspect
    // Re-anchor on the fixed side; edge handles grow symmetrically on the free axis.
    if (movesX === 'l') l = r - w
    else if (movesX === 'r') r = l + w
    else {
      const cx = initial.w / 2
      l = cx - w / 2
      r = cx + w / 2
    }
    if (movesY === 't') t = b - h
    else if (movesY === 'b') b = t + h
    else {
      const cy = initial.h / 2
      t = cy - h / 2
      b = cy + h / 2
    }
  }

  const w = r - l
  const h = b - t
  // New center in local space, rotated back to page space.
  const localCenter = vec((l + r) / 2 - initial.w / 2, (t + b) / 2 - initial.h / 2)
  const c = add(shapeCenter(initial), rot(localCenter, initial.rotation))
  return { x: c.x - w / 2, y: c.y - h / 2, w, h }
}

export function angleOf(center: Vec, p: Vec) {
  return Math.atan2(p.y - center.y, p.x - center.x)
}

export function snapAngle(a: number, step = Math.PI / 12) {
  return Math.round(a / step) * step
}

export function normalizeAngle(a: number) {
  const t = Math.PI * 2
  return ((a % t) + t) % t
}

/** Rotate a shape around an external pivot by `delta` radians. */
export function rotateAround(s: Rect, pivot: Vec, delta: number): { x: number; y: number; rotation: number } {
  const c = add(pivot, rot(sub(shapeCenter(s), pivot), delta))
  return { x: c.x - s.w / 2, y: c.y - s.h / 2, rotation: normalizeAngle(s.rotation + delta) }
}

/** Bounds of a flat [x,y,p,...] point list. */
export function pointsBounds(pts: number[]): Box {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < pts.length; i += 3) {
    minX = Math.min(minX, pts[i])
    minY = Math.min(minY, pts[i + 1])
    maxX = Math.max(maxX, pts[i])
    maxY = Math.max(maxY, pts[i + 1])
  }
  if (minX === Infinity) return { x: 0, y: 0, w: 0, h: 0 }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}
