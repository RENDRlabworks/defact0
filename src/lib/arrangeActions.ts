import type { Editor } from '../engine/Editor'
import type { Shape } from '../engine/types'
import { clusterLayout, gridLayout, groupByAssignment, kMeans, suggestK, type Placement } from './arrange'
import { featuresForShape } from './similarity'

/** Shapes that can be arranged: the selection minus frames (frames carry their children). */
function arrangeable(editor: Editor, ids: string[]): Shape[] {
  return ids.map((id) => editor.getShape(id)).filter((s): s is Shape => !!s && s.type !== 'frame')
}

function boxesFor(editor: Editor, shapes: Shape[]) {
  return shapes.map((s) => {
    const b = editor.getBounds(s.id)!
    return { id: s.id, w: b.w, h: b.h }
  })
}

/** Convert placements of bounding boxes into shape x/y (rotation-aware). */
function toPatches(editor: Editor, placements: Placement[]) {
  return placements.map((p) => {
    const s = editor.getShape(p.id)!
    const b = editor.getBounds(p.id)!
    return { id: p.id, x: s.x + (p.x - b.x), y: s.y + (p.y - b.y) }
  })
}

function sorted(editor: Editor, shapes: Shape[]) {
  return [...shapes].sort((a, b) => {
    const d = a.createdAt - b.createdAt
    if (d) return d
    const ba = editor.getBounds(a.id)!
    const bb = editor.getBounds(b.id)!
    return ba.y - bb.y || ba.x - bb.x
  })
}

export function arrangeGrid(editor: Editor, ids: string[]) {
  const shapes = sorted(editor, arrangeable(editor, ids))
  if (shapes.length < 2) return
  const bounds = editor.getBoundsOf(shapes.map((s) => s.id))!
  editor.animateShapes(toPatches(editor, gridLayout(boxesFor(editor, shapes), { x: bounds.x, y: bounds.y })))
}

/**
 * Cluster by visual similarity (k-means on tiny image features), lay each cluster out
 * as its own band, and optionally wrap each cluster in a frame.
 */
export async function arrangeBySimilarity(editor: Editor, ids: string[], opts: { frames?: boolean } = {}) {
  const shapes = sorted(editor, arrangeable(editor, ids))
  if (shapes.length < 2) return
  const bounds = editor.getBoundsOf(shapes.map((s) => s.id))!
  const vectors = await Promise.all(shapes.map((s) => featuresForShape(s)))
  const clusters = groupByAssignment(shapes, kMeans(vectors, suggestK(shapes.length)))
  const { placements } = clusterLayout(
    clusters.map((c) => boxesFor(editor, c)),
    { x: bounds.x, y: bounds.y },
    { padding: opts.frames ? 40 : 0 }
  )
  if (!opts.frames) return editor.animateShapes(toPatches(editor, placements))
  editor.run(() => {
    editor.updateShapes(toPatches(editor, placements))
    editor.updateShapes(shapes.map((s) => ({ id: s.id, parentId: null })))
    clusters.forEach((c, i) => editor.frameShapes(c.map((s) => s.id), `Similar ${i + 1}`, 32))
  })
}
