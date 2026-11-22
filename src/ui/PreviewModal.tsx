import { useEffect, useMemo, useState } from 'react'
import { useEditor, useImageOrVideoAsset, useValue, type TLAssetId, type TLShapeId } from 'tldraw'
import { isCard } from '../lib/canvas'
import { detectCode } from '../lib/detect'
import { parseTags } from '../lib/search'
import { getSessions } from '../lib/sessions'
import { ui } from '../lib/uiState'
import { CARD_TYPE, type CardShape } from '../shapes/cardTypes'
import { cardSizeForText } from '../shapes/CardShapeUtil'
import { formatDate, Modal } from './common'
import { Icon } from './icons'

/** Large preview + editor for a card. Opens on double-click, Enter or P. */
export function PreviewModal() {
  const editor = useEditor()
  const id = useValue('previewId', () => ui.previewId.get(), [])
  const shape = useValue('preview shape', () => (id ? editor.getShape(id as TLShapeId) : undefined), [editor, id])
  if (!id || !isCard(shape)) return null
  return <PreviewInner key={shape.id} shape={shape} />
}

function PreviewInner({ shape }: { shape: CardShape }) {
  const editor = useEditor()
  const p = shape.props
  const { url } = useImageOrVideoAsset({ shapeId: shape.id, assetId: (p.assetId as TLAssetId) ?? null, width: 2400 })
  const sessions = useValue('sessions', () => getSessions(editor), [editor])
  const [title, setTitle] = useState(p.title)
  const [text, setText] = useState(p.text)
  const [tags, setTags] = useState(p.tags.join(', '))
  const [isCode, setIsCode] = useState(p.isCode)
  const [language, setLanguage] = useState(p.language)
  const [sessionId, setSessionId] = useState(p.sessionId)
  const [copied, setCopied] = useState(false)

  // Cards in reading order, for prev/next.
  const order = useMemo(
    () =>
      editor
        .getCurrentPageShapes()
        .filter(isCard)
        .sort((a, b) => a.props.createdAt - b.props.createdAt)
        .map((s) => s.id),
    [editor]
  )
  const idx = order.indexOf(shape.id)

  const dirty =
    title !== p.title ||
    text !== p.text ||
    tags !== p.tags.join(', ') ||
    isCode !== p.isCode ||
    language !== p.language ||
    sessionId !== p.sessionId

  const save = () => {
    if (!dirty) return
    const nextText = text
    const patch: Partial<CardShape['props']> = {
      title,
      text: nextText,
      tags: parseTags(tags),
      isCode,
      language,
      sessionId,
    }
    // A text-only card that just got its first text: grow it to fit.
    if (!p.assetId && !p.text.trim() && nextText.trim()) Object.assign(patch, cardSizeForText(nextText))
    // An image card that just got text: make room under the image.
    if (p.assetId && !p.text.trim() && nextText.trim()) patch.h = p.h + Math.min(220, cardSizeForText(nextText).h - 20)
    editor.markHistoryStoppingPoint('edit card')
    editor.updateShape<CardShape>({ id: shape.id, type: CARD_TYPE, props: patch })
  }

  const close = () => {
    save()
    ui.previewId.set(null)
  }
  const go = (delta: number) => {
    save()
    const next = order[idx + delta]
    if (next) {
      editor.select(next)
      ui.previewId.set(next)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <Modal
      wide
      onClose={close}
      title={
        <input
          className="d0-input d0-input--title"
          value={title}
          placeholder={p.assetId ? 'Screenshot title' : 'Card title'}
          onChange={(e) => setTitle(e.target.value)}
        />
      }
      footer={
        <>
          <button className="d0-icon-btn" disabled={idx <= 0} onClick={() => go(-1)} title="Previous card (←)">
            {Icon.chevronLeft}
          </button>
          <span className="d0-muted">
            {idx + 1} / {order.length} · created {formatDate(p.createdAt)}
          </span>
          <button className="d0-icon-btn" disabled={idx >= order.length - 1} onClick={() => go(1)} title="Next card (→)">
            {Icon.chevronRight}
          </button>
          <span className="d0-spacer" />
          {text && (
            <button
              className="d0-btn"
              onClick={async () => {
                await navigator.clipboard.writeText(text)
                setCopied(true)
                setTimeout(() => setCopied(false), 1200)
              }}
            >
              {Icon.copy} {copied ? 'Copied' : 'Copy text'}
            </button>
          )}
          {url && (
            <a className="d0-btn" href={url} download={(title || 'image') + '.png'}>
              {Icon.download} Image
            </a>
          )}
          <button className="d0-btn d0-btn--primary" onClick={close}>
            Done
          </button>
        </>
      }
    >
      <div className={`d0-preview ${p.assetId ? 'has-image' : ''}`}>
        {p.assetId && <div className="d0-preview__image">{url ? <img src={url} alt={title} /> : <span className="d0-muted">Loading…</span>}</div>}
        <div className="d0-preview__side">
          <label className="d0-label" htmlFor="d0-text">
            {p.assetId ? 'Notes / snippet' : 'Text'}
          </label>
          <textarea
            id="d0-text"
            data-autofocus={!p.assetId || undefined}
            className={`d0-input d0-textarea ${isCode ? 'is-code' : ''}`}
            value={text}
            spellCheck={!isCode}
            placeholder="Paste code, a prompt, or notes…"
            onChange={(e) => {
              const v = e.target.value
              setText(v)
              if (!p.text && !text && v.length > 20) {
                const d = detectCode(v)
                setIsCode(d.isCode)
                if (d.language) setLanguage(d.language)
              }
            }}
          />
          <div className="d0-row">
            <label className="d0-check">
              <input type="checkbox" checked={isCode} onChange={(e) => setIsCode(e.target.checked)} /> Code
            </label>
            {isCode && <input className="d0-input" style={{ flex: 1 }} placeholder="language" value={language} onChange={(e) => setLanguage(e.target.value)} />}
          </div>
          <label className="d0-label" htmlFor="d0-tags">
            Tags
          </label>
          <input id="d0-tags" className="d0-input" placeholder="auth flow, bug, frontend" value={tags} onChange={(e) => setTags(e.target.value)} />
          <label className="d0-label" htmlFor="d0-session">
            Chat session
          </label>
          <select id="d0-session" className="d0-input" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
            <option value="">None</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {sessionId && sessions.find((s) => s.id === sessionId)?.url && (
            <a className="d0-session__url" href={sessions.find((s) => s.id === sessionId)!.url} target="_blank" rel="noreferrer noopener">
              {Icon.link} Open chat
            </a>
          )}
        </div>
      </div>
    </Modal>
  )
}
