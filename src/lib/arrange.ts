/** Pure layout helpers. Kept free of tldraw imports so they are easy to unit test. */

export interface Box {
  id: string
  w: number
  h: number
}

export interface Placement {
  id: string
  x: number
  y: number
}

/**
 * Pack boxes into a grid of rows, left-to-right. The column count defaults to
 * roughly sqrt(n) so the result is close to square.
 */
export function gridLayout(
  boxes: Box[],
  origin: { x: number; y: number },
  opts: { gap?: number; columns?: number } = {}
): Placement[] {
  const gap = opts.gap ?? 32
  const columns = Math.max(1, opts.columns ?? Math.ceil(Math.sqrt(boxes.length)))
  const out: Placement[] = []
  let y = origin.y
  for (let row = 0; row * columns < boxes.length; row++) {
    const items = boxes.slice(row * columns, row * columns + columns)
    let x = origin.x
    let rowH = 0
    for (const b of items) {
      out.push({ id: b.id, x, y })
      x += b.w + gap
      rowH = Math.max(rowH, b.h)
    }
    y += rowH + gap
  }
  return out
}

/**
 * Lay out several clusters one after another, each cluster as its own row band.
 * Returns placements plus the bounds of each cluster (handy for drawing frames).
 */
export function clusterLayout(
  clusters: Box[][],
  origin: { x: number; y: number },
  opts: { gap?: number; clusterGap?: number; padding?: number } = {}
): { placements: Placement[]; bounds: { x: number; y: number; w: number; h: number }[] } {
  const gap = opts.gap ?? 24
  const clusterGap = opts.clusterGap ?? 80
  const padding = opts.padding ?? 0
  const placements: Placement[] = []
  const bounds: { x: number; y: number; w: number; h: number }[] = []
  let y = origin.y
  for (const cluster of clusters) {
    if (!cluster.length) continue
    const grid = gridLayout(cluster, { x: origin.x + padding, y: y + padding }, { gap, columns: Math.min(cluster.length, Math.max(3, Math.ceil(Math.sqrt(cluster.length)))) })
    let maxX = origin.x
    let maxY = y
    for (const p of grid) {
      const b = cluster.find((c) => c.id === p.id)!
      maxX = Math.max(maxX, p.x + b.w)
      maxY = Math.max(maxY, p.y + b.h)
    }
    bounds.push({ x: origin.x, y, w: maxX - origin.x + padding, h: maxY - y + padding })
    placements.push(...grid)
    y = maxY + padding + clusterGap
  }
  return { placements, bounds }
}

/** Squared euclidean distance. */
export function dist2(a: number[], b: number[]) {
  let d = 0
  for (let i = 0; i < a.length; i++) d += (a[i] - b[i]) ** 2
  return d
}

/**
 * Deterministic k-means. Seeds with k-means++-style farthest-point picks starting from the
 * first vector so the same input always gives the same clusters.
 */
export function kMeans(vectors: number[][], k: number, iterations = 20): number[] {
  const n = vectors.length
  if (n === 0) return []
  k = Math.max(1, Math.min(k, n))
  const centroids: number[][] = [vectors[0].slice()]
  while (centroids.length < k) {
    let best = 0
    let bestD = -1
    for (let i = 0; i < n; i++) {
      const d = Math.min(...centroids.map((c) => dist2(c, vectors[i])))
      if (d > bestD) {
        bestD = d
        best = i
      }
    }
    centroids.push(vectors[best].slice())
  }
  const assign = new Array<number>(n).fill(0)
  for (let it = 0; it < iterations; it++) {
    let changed = false
    for (let i = 0; i < n; i++) {
      let bi = 0
      let bd = Infinity
      for (let c = 0; c < k; c++) {
        const d = dist2(centroids[c], vectors[i])
        if (d < bd) {
          bd = d
          bi = c
        }
      }
      if (assign[i] !== bi) {
        assign[i] = bi
        changed = true
      }
    }
    for (let c = 0; c < k; c++) {
      const members = vectors.filter((_, i) => assign[i] === c)
      if (!members.length) continue
      centroids[c] = members[0].map((_, d) => members.reduce((s, m) => s + m[d], 0) / members.length)
    }
    if (!changed && it > 0) break
  }
  return assign
}

/** Pick a cluster count for n items: about sqrt(n/2), at least 1, at most 8. */
export function suggestK(n: number) {
  return Math.max(1, Math.min(8, Math.round(Math.sqrt(n / 2))))
}

/** Group item ids by cluster assignment, ordered by first appearance. */
export function groupByAssignment<T>(items: T[], assign: number[]): T[][] {
  const order: number[] = []
  const map = new Map<number, T[]>()
  items.forEach((item, i) => {
    const a = assign[i]
    if (!map.has(a)) {
      map.set(a, [])
      order.push(a)
    }
    map.get(a)!.push(item)
  })
  return order.map((a) => map.get(a)!)
}
