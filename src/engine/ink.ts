import { getStroke } from 'perfect-freehand'
import type { InkColor, NoteColor } from './types'

export const INK_COLORS: InkColor[] = ['default', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey']
export const NOTE_COLORS: NoteColor[] = ['yellow', 'orange', 'pink', 'green', 'blue', 'violet', 'grey']
export const INK_SIZES = [2, 4, 8, 14]

export const inkVar = (c: InkColor) => `var(--ink-${c})`
export const noteVar = (c: NoteColor) => `var(--note-${c})`

/** Outline polygon for a flat [x,y,p,...] stroke, as an SVG path. */
export function strokePath(points: number[], size: number): string {
  const input: [number, number, number][] = []
  let hasPressure = false
  for (let i = 0; i < points.length; i += 3) {
    input.push([points[i], points[i + 1], points[i + 2]])
    if (points[i + 2] !== 0.5) hasPressure = true
  }
  const outline = getStroke(input, {
    size,
    thinning: 0.55,
    smoothing: 0.5,
    streamline: 0.45,
    simulatePressure: !hasPressure,
    last: true,
  })
  if (!outline.length) return ''
  const d = outline.reduce(
    (acc: (string | number)[], [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length]
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      return acc
    },
    ['M', ...outline[0], 'Q']
  )
  d.push('Z')
  return d.map((v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)).join(' ')
}
