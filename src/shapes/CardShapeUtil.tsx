import {
  BaseBoxShapeUtil,
  createShapeId,
  FileHelpers,
  HTMLContainer,
  T,
  useEditor,
  useImageOrVideoAsset,
  useValue,
  type RecordProps,
  type SvgExportContext,
  type TLAsset,
  type TLAssetId,
  type TLShapePartial,
  type VecModel,
} from 'tldraw'
import { getSessions, sessionColor } from '../lib/sessions'
import {
  CARD_HEADER_H,
  CARD_MAX_W,
  CARD_TYPE,
  type CardShape,
  type CardShapeProps,
} from './cardTypes'

/** Size a new image card so the image fits inside CARD_MAX_W while keeping its aspect ratio. */
export function cardSizeForImage(imgW: number, imgH: number): { w: number; h: number } {
  const w0 = Math.max(1, imgW)
  const h0 = Math.max(1, imgH)
  const scale = Math.min(1, CARD_MAX_W / w0, 640 / h0)
  const w = Math.max(160, Math.round(w0 * scale))
  return { w, h: Math.round((w / w0) * h0) + CARD_HEADER_H }
}

/** Size a new text-only card based on its line count. */
export function cardSizeForText(text: string): { w: number; h: number } {
  const lines = text.split('\n')
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0)
  const w = Math.min(CARD_MAX_W, Math.max(260, longest * 7.4 + 32))
  const wrapped = lines.reduce((n, l) => n + Math.max(1, Math.ceil((l.length * 7.4) / (w - 24))), 0)
  const h = Math.min(560, Math.max(110, wrapped * 18 + CARD_HEADER_H + 28))
  return { w: Math.round(w), h: Math.round(h) }
}

export class CardShapeUtil extends BaseBoxShapeUtil<CardShape> {
  static override type = CARD_TYPE
  static override handledAssetTypes = ['image'] as const

  static override props: RecordProps<CardShape> = {
    w: T.nonZeroNumber,
    h: T.nonZeroNumber,
    assetId: T.string.nullable(),
    title: T.string,
    text: T.string,
    isCode: T.boolean,
    language: T.string,
    tags: T.arrayOf(T.string),
    sessionId: T.string,
    createdAt: T.number,
  }

  getDefaultProps(): CardShapeProps {
    return {
      w: 320,
      h: 200,
      assetId: null,
      title: '',
      text: '',
      isCode: false,
      language: '',
      tags: [],
      sessionId: '',
      createdAt: Date.now(),
    }
  }

  /** Dropped/pasted images become cards instead of plain image shapes. */
  override createShapeForAsset(asset: TLAsset, position: VecModel): TLShapePartial<CardShape> | null {
    if (asset.type !== 'image') return null
    const { w, h } = cardSizeForImage(asset.props.w, asset.props.h)
    return {
      id: createShapeId(),
      type: CARD_TYPE,
      x: position.x,
      y: position.y,
      props: {
        w,
        h,
        assetId: asset.id,
        title: stripExtension(asset.props.name || 'Screenshot'),
        createdAt: Date.now(),
      },
    }
  }

  override canEdit() {
    // "Editing" a card opens the preview/editor modal (see useCardPreviewBridge).
    return true
  }
  override isAspectRatioLocked() {
    return false
  }
  override canCrop() {
    return false
  }

  override getText(shape: CardShape): string {
    const p = shape.props
    return [p.title, p.text, p.tags.join(' ')].filter(Boolean).join('\n')
  }

  component(shape: CardShape) {
    return <CardComponent shape={shape} />
  }

  getIndicatorPath(shape: CardShape) {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 10)
    return path
  }

  override async toSvg(shape: CardShape, ctx: SvgExportContext) {
    const { w, h, title, text, assetId, isCode, tags } = shape.props
    const dark = ctx.colorMode === 'dark'
    const bg = dark ? '#1b1b1f' : '#ffffff'
    const border = dark ? '#34343a' : '#d9d9de'
    const fg = dark ? '#ececf1' : '#18181b'
    const muted = dark ? '#9a9aa5' : '#5f5f6b'
    let src: string | null = null
    if (assetId) {
      try {
        src = await ctx.resolveAssetUrl(assetId as TLAssetId, w)
        if (src && !src.startsWith('data:')) src = await FileHelpers.urlToDataUrl(src)
      } catch {
        src = null
      }
    }
    const bodyTop = CARD_HEADER_H
    const imgH = src ? (text ? (h - bodyTop) * 0.62 : h - bodyTop) : 0
    const textLines = text.split('\n').slice(0, Math.max(0, Math.floor((h - bodyTop - imgH - 12) / 16)))
    const clipId = `card-clip-${shape.id.replace(/[^a-z0-9]/gi, '')}`
    return (
      <g>
        <defs>
          <clipPath id={clipId}>
            <rect width={w} height={h} rx={10} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <rect width={w} height={h} fill={bg} />
          {src && <image href={src} x={0} y={bodyTop} width={w} height={imgH} preserveAspectRatio="xMidYMid meet" />}
          <text x={12} y={22} fill={fg} fontSize={13} fontWeight={600} fontFamily="Inter, system-ui, sans-serif">
            {title || (tags.length ? '#' + tags.join(' #') : 'Card')}
          </text>
          {textLines.map((line, i) => (
            <text
              key={i}
              x={12}
              y={bodyTop + imgH + 18 + i * 16}
              fill={isCode ? fg : muted}
              fontSize={12}
              fontFamily={isCode ? 'ui-monospace, Menlo, monospace' : 'Inter, system-ui, sans-serif'}
              xmlSpace="preserve"
            >
              {line}
            </text>
          ))}
        </g>
        <rect width={w} height={h} rx={10} fill="none" stroke={border} />
      </g>
    )
  }
}

function stripExtension(name: string) {
  return name.replace(/\.[a-z0-9]{2,5}$/i, '')
}

function CardComponent({ shape }: { shape: CardShape }) {
  const { w, h, assetId, title, text, isCode, tags, sessionId, language } = shape.props
  const { url } = useImageOrVideoAsset({ shapeId: shape.id, assetId: (assetId as TLAssetId) ?? null, width: w })
  const editor = useEditor()
  const session = useValue('card session', () => getSessions(editor).find((s) => s.id === sessionId), [editor, sessionId])
  const hasImage = Boolean(assetId)
  const hasText = text.trim().length > 0

  return (
    <HTMLContainer
      className={`d0-card ${hasImage ? 'd0-card--image' : ''} ${hasText ? 'd0-card--text' : ''}`}
      style={{ width: w, height: h }}
    >
      <div className="d0-card__header" style={{ height: CARD_HEADER_H }}>
        {session && (
          <span
            className="d0-card__session"
            title={`Session: ${session.name}`}
            style={{ background: sessionColor(session.id) }}
          />
        )}
        <span className="d0-card__title">{title || (hasImage ? 'Image' : isCode ? language || 'Snippet' : 'Note')}</span>
        <span className="d0-card__tags">
          {tags.slice(0, 4).map((t) => (
            <span key={t} className="d0-tag">
              {t}
            </span>
          ))}
          {tags.length > 4 && <span className="d0-tag">+{tags.length - 4}</span>}
        </span>
      </div>
      <div className="d0-card__body">
        {hasImage && (
          <div className="d0-card__image">
            {url ? <img src={url} alt={title} draggable={false} /> : <div className="d0-card__placeholder">Loading…</div>}
          </div>
        )}
        {hasText && (isCode ? <pre className="d0-card__code">{text}</pre> : <div className="d0-card__text">{text}</div>)}
        {!hasImage && !hasText && <div className="d0-card__placeholder">Double-click to edit</div>}
      </div>
    </HTMLContainer>
  )
}
