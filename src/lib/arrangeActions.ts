import type { Editor, TLShape, TLShapeId } from 'tldraw'
import { clusterLayout, gridLayout, groupByAssignment, kMeans, suggestK, type Placement } from './arrange'
import { arrangeableShapes, frameShapes, getCreatedAt, pageBoundsOf } from './canvas'
import { featuresForShape } from './similarity'

function boxesFor(editor: Editor, shapes: TLShape[]) {
  return shapes.map((s) => {
    const b = editor.getShapePageBounds(s.id)!
    return { id: s.id as string, w: b.w, h: b.h }
  })
}

/** Move shapes so their page-space bounding box top-left lands on the placement. */
function applyPlacements(editor: Editor, placements: Placement[], animate = true) {
  const partials = placements.map((p) => {
    const id = p.id as TLShapeId
    const shape = editor.getShape(id)!
    const bounds = editor.getShapePageBounds(id)!
    const origin = editor.getShapePageTransform(id).point()
    const target = { x: origin.x + (p.x - bounds.x), y: origin.y + (p.y - bounds.y) }
    const local = editor.getPointInParentSpace(id, target)
    return { id, type: shape.type, x: local.x, y: local.y }
  })
  if (animate) editor.animateShapes(partials, { animation: { duration: 260 } })
  else editor.updateShapes(partials)
}

function sortedForLayout(editor: Editor, shapes: TLShape[]) {
  return [...shapes].sort((a, b) => {
    const d = getCreatedAt(a) - getCreatedAt(b)
    if (d) return d
    const ba = editor.getShapePageBounds(a.id)!
    const bb = editor.getShapePageBounds(b.id)!
    return ba.y - bb.y || ba.x - bb.x
  })
}

export function arrangeGrid(editor: Editor, ids: TLShapeId[]) {
  const shapes = sortedForLayout(editor, arrangeableShapes(editor, ids))
  if (shapes.length < 2) return
  const bounds = pageBoundsOf(editor, shapes.map((s) => s.id))!
  editor.markHistoryStoppingPoint('arrange grid')
  applyPlacements(editor, gridLayout(boxesFor(editor, shapes), { x: bounds.x, y: bounds.y }))
}

/**
 * Cluster by visual similarity (k-means on tiny image features), lay each cluster out
 * as its own band, and optionally wrap each cluster in a frame.
 */
export async function arrangeBySimilarity(editor: Editor, ids: TLShapeId[], opts: { frames?: boolean } = {}) {
  const shapes = sortedForLayout(editor, arrangeableShapes(editor, ids))
  if (shapes.length < 2) return
  const bounds = pageBoundsOf(editor, shapes.map((s) => s.id))!
  const vectors = await Promise.all(shapes.map((s) => featuresForShape(editor, s)))
  const assign = kMeans(vectors, suggestK(shapes.length))
  const clusters = groupByAssignment(shapes, assign)
  const pad = opts.frames ? 40 : 0
  const { placements } = clusterLayout(
    clusters.map((c) => boxesFor(editor, c)),
    { x: bounds.x, y: bounds.y },
    { padding: pad }
  )
  editor.markHistoryStoppingPoint('arrange by similarity')
  if (!opts.frames) return applyPlacements(editor, placements)
  editor.run(() => {
    applyPlacements(editor, placements, false)
    clusters.forEach((c, i) => frameShapes(editor, c.map((s) => s.id), `Similar ${i + 1}`, 32))
  })
}
