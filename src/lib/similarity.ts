import { getAssetUrl } from '../engine/assets'
import type { Shape } from '../engine/types'

/**
 * A tiny visual feature vector for an image: mean color, saturation and a 4x4 luminance layout.
 * Good enough to put "dark terminal screenshots", "white diagrams" and "colorful UI shots"
 * next to each other without any ML.
 */
const SIZE = 16
const cache = new Map<string, Promise<number[] | null>>()

export function featuresFromPixels(data: Uint8ClampedArray, size = SIZE): number[] {
  let r = 0
  let g = 0
  let b = 0
  let sat = 0
  const grid = new Array(16).fill(0)
  const counts = new Array(16).fill(0)
  const n = size * size
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const R = data[i] / 255
      const G = data[i + 1] / 255
      const B = data[i + 2] / 255
      r += R
      g += G
      b += B
      sat += Math.max(R, G, B) - Math.min(R, G, B)
      const cell = Math.floor((y / size) * 4) * 4 + Math.floor((x / size) * 4)
      grid[cell] += 0.299 * R + 0.587 * G + 0.114 * B
      counts[cell]++
    }
  }
  return [(r / n) * 2, (g / n) * 2, (b / n) * 2, (sat / n) * 2, ...grid.map((v, i) => v / Math.max(1, counts[i]))]
}

async function featuresForAsset(assetId: string): Promise<number[] | null> {
  const src = await getAssetUrl(assetId)
  if (!src) return null
  const img = new Image()
  img.src = src
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, SIZE, SIZE)
  return featuresFromPixels(ctx.getImageData(0, 0, SIZE, SIZE).data)
}

/** Non-image shapes get fixed vectors far from typical images so they cluster together. */
const TEXT_VECTOR = [0, 0, 0, -1, ...new Array(16).fill(0)]

export async function featuresForShape(shape: Shape): Promise<number[]> {
  const assetId = shape.type === 'card' ? shape.assetId : null
  if (!assetId) {
    const v = TEXT_VECTOR.slice()
    if (shape.type === 'card' && shape.isCode) v[3] = -1.5
    if (shape.type === 'note') v[3] = -2
    if (shape.type === 'draw') v[3] = -2.5
    return v
  }
  let p = cache.get(assetId)
  if (!p) {
    p = featuresForAsset(assetId).catch(() => null)
    cache.set(assetId, p)
  }
  return (await p) ?? TEXT_VECTOR.slice()
}
