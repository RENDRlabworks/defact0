import { getAssetUrl } from './assets'
import type { Editor } from './Editor'
import { boxUnion, shapeBounds, shapeCenter } from './geometry'
import { strokePath } from './ink'
import { CARD_HEADER_H } from './render/ShapeViews'
import type { Box, CardShape, Shape } from './types'

const MAX_PIXELS = 48_000_000
const FONT = 'Inter, ui-sans-serif, system-ui, sans-serif'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

function css(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  try {
    const img = new Image()
    img.src = src
    await img.decode()
    return img
  } catch {
    return null
  }
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/(\s+)/)) {
      if (ctx.measureText(line + word).width > maxW && line) {
        out.push(line)
        line = word.trimStart()
      } else line += word
      if (out.length >= maxLines) return out
    }
    out.push(line)
    if (out.length >= maxLines) return out
  }
  return out
}

/**
 * Render shapes into a PNG with the canvas 2D API. Exports what you see: frames, cards with
 * their images and text, notes and drawings.
 */
export async function renderPng(editor: Editor, ids: string[], opts: { bounds?: Box; padding?: number; scale?: number } = {}): Promise<Blob | null> {
  const set = new Set(editor.withChildren(ids))
  const shapes = editor.getRenderOrder().filter((s) => set.has(s.id))
  if (!shapes.length) return null
  const pad = opts.bounds ? 0 : opts.padding ?? 32
  const content = opts.bounds ?? boxUnion(shapes.map(shapeBounds))!
  const box = { x: content.x - pad, y: content.y - pad, w: content.w + pad * 2, h: content.h + pad * 2 }
  let scale = opts.scale ?? 2
  if (box.w * box.h * scale * scale > MAX_PIXELS) scale = Math.sqrt(MAX_PIXELS / (box.w * box.h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(box.w * scale))
  canvas.height = Math.max(1, Math.round(box.h * scale))
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.translate(-box.x, -box.y)
  ctx.fillStyle = css('--d0-canvas-bg')
  ctx.fillRect(box.x, box.y, box.w, box.h)

  const images = new Map<string, HTMLImageElement | null>()
  await Promise.all(
    shapes
      .filter((s): s is CardShape => s.type === 'card' && !!s.assetId)
      .map(async (s) => {
        const url = await getAssetUrl(s.assetId!)
        images.set(s.id, url ? await loadImage(url) : null)
      })
  )

  for (const s of shapes) {
    ctx.save()
    const c = shapeCenter(s)
    ctx.translate(c.x, c.y)
    ctx.rotate(s.rotation)
    ctx.translate(-s.w / 2, -s.h / 2)
    drawShape(ctx, s, images.get(s.id) ?? null)
    ctx.restore()
  }
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
}

function drawShape(ctx: CanvasRenderingContext2D, s: Shape, img: HTMLImageElement | null) {
  switch (s.type) {
    case 'frame': {
      ctx.fillStyle = css('--d0-frame-bg')
      ctx.strokeStyle = css('--d0-frame-border')
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(0, 0, s.w, s.h, 6)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = css('--d0-muted')
      ctx.font = `500 13px ${FONT}`
      ctx.fillText(s.name, 2, -8)
      return
    }
    case 'note': {
      ctx.shadowColor = 'rgba(0,0,0,0.25)'
      ctx.shadowBlur = 8
      ctx.shadowOffsetY = 2
      ctx.fillStyle = css(`--note-${s.color}`)
      ctx.beginPath()
      ctx.roundRect(0, 0, s.w, s.h, 4)
      ctx.fill()
      ctx.shadowColor = 'transparent'
      const size = s.text.length > 140 ? 14 : s.text.length > 60 ? 17 : 20
      ctx.fillStyle = '#1d1d1f'
      ctx.font = `500 ${size}px ${FONT}`
      wrapLines(ctx, s.text, s.w - 32, Math.floor((s.h - 32) / (size * 1.3))).forEach((l, i) => ctx.fillText(l, 16, 16 + size + i * size * 1.3))
      return
    }
    case 'draw': {
      ctx.fillStyle = css(`--ink-${s.color}`)
      ctx.fill(new Path2D(strokePath(s.points, s.size)))
      return
    }
    case 'card':
      return drawCard(ctx, s, img)
  }
}

function drawCard(ctx: CanvasRenderingContext2D, s: CardShape, img: HTMLImageElement | null) {
  const border = css('--d0-border')
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(0, 0, s.w, s.h, 10)
  ctx.fillStyle = css('--d0-bg')
  ctx.fill()
  ctx.clip()
  ctx.fillStyle = css('--d0-bg-2')
  ctx.fillRect(0, 0, s.w, CARD_HEADER_H)
  ctx.fillStyle = css('--d0-text')
  ctx.font = `600 13px ${FONT}`
  const title = s.title || (s.assetId ? 'Image' : s.isCode ? s.language || 'Snippet' : 'Note')
  ctx.fillText(wrapLines(ctx, title, s.w - 24, 1)[0] ?? '', 12, 22)
  const bodyH = s.h - CARD_HEADER_H
  const hasText = !!s.text.trim()
  const imgH = s.assetId ? (hasText ? bodyH * 0.62 : bodyH) : 0
  if (s.assetId) {
    ctx.fillStyle = css('--d0-code-bg')
    ctx.fillRect(0, CARD_HEADER_H, s.w, imgH)
    if (img) {
      const k = Math.min(s.w / img.naturalWidth, imgH / img.naturalHeight)
      const w = img.naturalWidth * k
      const h = img.naturalHeight * k
      ctx.drawImage(img, (s.w - w) / 2, CARD_HEADER_H + (imgH - h) / 2, w, h)
    }
  }
  if (hasText) {
    const top = CARD_HEADER_H + imgH
    if (s.isCode) {
      ctx.fillStyle = css('--d0-code-bg')
      ctx.fillRect(0, top, s.w, s.h - top)
    }
    ctx.fillStyle = css('--d0-text')
    ctx.font = s.isCode ? `12px ${MONO}` : `13px ${FONT}`
    const lh = 18
    wrapLines(ctx, s.text, s.w - 24, Math.floor((s.h - top - 16) / lh)).forEach((l, i) => ctx.fillText(l, 12, top + 22 + i * lh))
  }
  ctx.restore()
  ctx.strokeStyle = border
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(0.5, 0.5, s.w - 1, s.h - 1, 10)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, CARD_HEADER_H)
  ctx.lineTo(s.w, CARD_HEADER_H)
  ctx.stroke()
}
