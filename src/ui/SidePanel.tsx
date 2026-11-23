import { useMemo, useState } from 'react'
import { useDerived, useDoc, useEditor, useUi } from '../engine/react'
import { buildIndex, setSession } from '../lib/canvas'
import { isQueryEmpty, search, tagCounts, type SearchItem, type SearchQuery } from '../lib/search'
import {
  createSession,
  deleteSession,
  guessSessionName,
  sessionColor,
  updateSession,
  type ChatSession,
} from '../lib/sessions'
import { app, useApp } from '../lib/uiState'
import { formatDate, shield, useJumpTo } from './common'
import { Icon } from './icons'

const DAY = 86_400_000

function startOfDay(ms: number) {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function toInputDate(ms: number | null) {
  if (ms == null) return ''
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fromInputDate(v: string, endOfDay = false): number | null {
  if (!v) return null
  const [y, m, d] = v.split('-').map(Number)
  const t = new Date(y, m - 1, d).getTime()
  return endOfDay ? t + DAY - 1 : t
}

/** Reactive index of everything searchable on the current page. */
function useIndex(): SearchItem[] {
  return useDerived(buildIndex)
}

export function SidePanel() {
  const panel = useApp((s) => s.panel)
  if (!panel) return null
  return (
    <aside className="d0-panel" {...shield}>
      <div className="d0-panel__tabs">
        <button className={panel === 'search' ? 'is-active' : ''} onClick={() => app.update({ panel: 'search' })}>
          {Icon.search} Search
        </button>
        <button className={panel === 'sessions' ? 'is-active' : ''} onClick={() => app.update({ panel: 'sessions' })}>
          {Icon.sessions} Sessions
        </button>
        <span className="d0-spacer" />
        <button className="d0-icon-btn" onClick={() => app.update({ panel: null })} title="Close panel" aria-label="Close panel">
          {Icon.close}
        </button>
      </div>
      {panel === 'search' ? <SearchView /> : <SessionsView />}
    </aside>
  )
}

/* ------------------------------- Search ------------------------------- */

function SearchView() {
  const editor = useEditor()
  const index = useIndex()
  const q = useApp((s) => s.query)
  const sessions = useDoc((d) => d.sessions)
  const jumpTo = useJumpTo()
  const setQ = (patch: Partial<SearchQuery>) => app.update({ query: { ...app.get().query, ...patch } })
  const results = useMemo(() => search(index, q), [index, q])
  const tags = useMemo(() => tagCounts(index), [index])
  const empty = isQueryEmpty(q)
  const now = Date.now()
  const preset = (days: number | null) =>
    setQ(days == null ? { from: null, to: null } : { from: startOfDay(now - (days - 1) * DAY), to: null })

  const resultIds = results.map((r) => r.id)

  return (
    <div className="d0-panel__content">
      <input
        className="d0-input d0-input--search"
        autoFocus
        placeholder="Search titles, snippets, notes, frames…"
        value={q.text}
        onChange={(e) => setQ({ text: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) jumpTo([results[0].id])
          if (e.key === 'Escape') app.update({ panel: null })
        }}
      />

      {tags.length > 0 && (
        <div className="d0-section">
          <div className="d0-label">Tags</div>
          <div className="d0-chips">
            {tags.map(({ tag, count }) => {
              const on = q.tags.includes(tag)
              return (
                <button
                  key={tag}
                  className={`d0-tag d0-tag--btn ${on ? 'is-on' : ''}`}
                  onClick={() => setQ({ tags: on ? q.tags.filter((t) => t !== tag) : [...q.tags, tag] })}
                >
                  {tag} <span className="d0-muted">{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="d0-section">
        <div className="d0-label">Date</div>
        <div className="d0-chips">
          {[
            ['Any', null],
            ['Today', 1],
            ['7 days', 7],
            ['30 days', 30],
          ].map(([label, days]) => {
            const on = days == null ? q.from == null && q.to == null : q.from === startOfDay(now - ((days as number) - 1) * DAY) && q.to == null
            return (
              <button key={label as string} className={`d0-tag d0-tag--btn ${on ? 'is-on' : ''}`} onClick={() => preset(days as number | null)}>
                {label}
              </button>
            )
          })}
        </div>
        <div className="d0-row">
          <input type="date" className="d0-input" value={toInputDate(q.from)} onChange={(e) => setQ({ from: fromInputDate(e.target.value) })} aria-label="From date" />
          <span className="d0-muted">to</span>
          <input type="date" className="d0-input" value={toInputDate(q.to)} onChange={(e) => setQ({ to: fromInputDate(e.target.value, true) })} aria-label="To date" />
        </div>
      </div>

      {sessions.length > 0 && (
        <div className="d0-section">
          <div className="d0-label">Session</div>
          <select className="d0-input" value={q.sessionId ?? ''} onChange={(e) => setQ({ sessionId: e.target.value || null })}>
            <option value="">All sessions</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="d0-results__head">
        <span className="d0-muted">
          {empty ? `${index.length} items on canvas` : `${results.length} result${results.length === 1 ? '' : 's'}`}
        </span>
        <span className="d0-spacer" />
        {!empty && results.length > 0 && (
          <>
            <button className="d0-link-btn" onClick={() => jumpTo(resultIds)}>
              Select all
            </button>
            <button
              className="d0-link-btn"
              onClick={() => {
                const name = q.text.trim() || q.tags.join(', ') || 'Search results'
                const ids = resultIds.filter((id) => editor.getShape(id)?.type !== 'frame')
                if (!ids.length) return
                const frameId = editor.frameShapes(ids, name)
                if (frameId) jumpTo([frameId])
              }}
            >
              Frame
            </button>
          </>
        )}
        {!empty && (
          <button className="d0-link-btn" onClick={() => app.update({ query: { text: '', tags: [], from: null, to: null, sessionId: null } })}>
            Clear
          </button>
        )}
      </div>

      <ul className="d0-results">
        {(empty ? [...index].sort((a, b) => b.createdAt - a.createdAt) : results).slice(0, 200).map((r) => (
          <ResultRow key={r.id} item={r} sessions={sessions} onClick={() => jumpTo([r.id])} />
        ))}
        {!empty && results.length === 0 && <li className="d0-empty">No matches.</li>}
        {empty && index.length === 0 && <li className="d0-empty">Nothing here yet. Drop some screenshots onto the canvas.</li>}
      </ul>
    </div>
  )
}

function ResultRow({ item, sessions, onClick }: { item: SearchItem; sessions: ChatSession[]; onClick(): void }) {
  const session = sessions.find((s) => s.id === item.sessionId)
  const snippet = item.text && item.text !== item.title ? item.text.slice(0, 140) : ''
  return (
    <li>
      <button
        className="d0-result"
        onClick={onClick}
        onDoubleClick={() => {
          onClick()
          if (item.kind === 'card') app.update({ previewId: item.id })
        }}
      >
        <span className={`d0-kind d0-kind--${item.kind}`}>{item.kind}</span>
        <span className="d0-result__main">
          <span className="d0-result__title">{item.title || '(untitled)'}</span>
          {snippet && <span className="d0-result__snippet">{snippet}</span>}
          <span className="d0-result__meta">
            {session && (
              <span className="d0-session-pill">
                <i style={{ background: sessionColor(session.id) }} />
                {session.name}
              </span>
            )}
            {item.tags.map((t) => (
              <span key={t} className="d0-tag">
                {t}
              </span>
            ))}
            <span className="d0-muted">{formatDate(item.createdAt)}</span>
          </span>
        </span>
      </button>
    </li>
  )
}

/* ------------------------------ Sessions ------------------------------ */

function SessionsView() {
  const editor = useEditor()
  const sessions = useDoc((d) => d.sessions)
  const index = useIndex()
  const selectionCount = useUi((u) => u.selectedIds.length)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [editing, setEditing] = useState<string | null>(null)

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of index) if (i.sessionId) m.set(i.sessionId, (m.get(i.sessionId) ?? 0) + 1)
    return m
  }, [index])
  const unassigned = index.filter((i) => i.kind === 'card' && !i.sessionId).length

  // Timeline: newest first, grouped by day.
  const byDay = useMemo(() => {
    const groups: { day: string; items: ChatSession[] }[] = []
    for (const s of [...sessions].sort((a, b) => b.createdAt - a.createdAt)) {
      const day = new Date(s.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
      const g = groups.find((x) => x.day === day)
      if (g) g.items.push(s)
      else groups.push({ day, items: [s] })
    }
    return groups
  }, [sessions])

  const add = () => {
    const n = name.trim() || guessSessionName(url) || `Session ${sessions.length + 1}`
    const s = createSession(editor, { name: n, url: url.trim() })
    if (selectionCount) setSession(editor, editor.getSelectedIds(), s.id)
    setName('')
    setUrl('')
  }

  return (
    <div className="d0-panel__content">
      <form
        className="d0-section d0-new-session"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <div className="d0-label">New chat session</div>
        <input className="d0-input" placeholder="Name, e.g. “Auth refactor”" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          className="d0-input"
          placeholder="Claude Code session URL (optional)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className="d0-btn d0-btn--primary" type="submit">
          {Icon.plus} {selectionCount ? `Create & assign ${selectionCount} selected` : 'Create session'}
        </button>
      </form>

      <div className="d0-results__head">
        <span className="d0-muted">
          {sessions.length} session{sessions.length === 1 ? '' : 's'} · {unassigned} unassigned card{unassigned === 1 ? '' : 's'}
        </span>
      </div>

      <div className="d0-timeline">
        {byDay.map((g) => (
          <div key={g.day} className="d0-timeline__day">
            <div className="d0-label">{g.day}</div>
            {g.items.map((s) =>
              editing === s.id ? (
                <SessionEditor key={s.id} session={s} onDone={() => setEditing(null)} />
              ) : (
                <SessionRow
                  key={s.id}
                  session={s}
                  count={counts.get(s.id) ?? 0}
                  selectionCount={selectionCount}
                  onEdit={() => setEditing(s.id)}
                />
              )
            )}
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="d0-empty">
            Create a session for each Claude Code conversation, then assign cards to it (select cards, press <kbd>Shift</kbd>+<kbd>C</kbd>). You can jump back to the cards or the chat any time.
          </div>
        )}
      </div>
    </div>
  )
}

function SessionRow({ session, count, selectionCount, onEdit }: { session: ChatSession; count: number; selectionCount: number; onEdit(): void }) {
  const editor = useEditor()
  const jumpTo = useJumpTo()
  const idsFor = () =>
    editor
      .getShapes()
      .filter((s) => s.sessionId === session.id)
      .map((s) => s.id)
  return (
    <div className="d0-session">
      <div className="d0-session__head">
        <i className="d0-session__dot" style={{ background: sessionColor(session.id) }} />
        <button className="d0-session__name" onClick={() => jumpTo(idsFor())} title="Jump to this session's cards">
          {session.name}
        </button>
        <span className="d0-muted">{count}</span>
      </div>
      {session.url && (
        <a className="d0-session__url" href={session.url} target="_blank" rel="noreferrer noopener">
          {Icon.link} {session.url.replace(/^https?:\/\//, '')}
        </a>
      )}
      <div className="d0-session__actions">
        <button className="d0-link-btn" disabled={!count} onClick={() => jumpTo(idsFor())}>
          {Icon.target} Jump
        </button>
        {session.url && (
          <a className="d0-link-btn" href={session.url} target="_blank" rel="noreferrer noopener">
            Open chat
          </a>
        )}
        <button className="d0-link-btn" disabled={!selectionCount} onClick={() => setSession(editor, editor.getSelectedIds(), session.id)}>
          Assign {selectionCount || ''}
        </button>
        <button
          className="d0-link-btn"
          disabled={!count}
          onClick={() => {
            const ids = idsFor().filter((id) => editor.getShape(id)?.type !== 'frame')
            if (!ids.length) return
            const frameId = editor.frameShapes(ids, session.name)
            if (frameId) {
              setSession(editor, [frameId], session.id)
              jumpTo([frameId])
            }
          }}
        >
          {Icon.frame} Frame
        </button>
        <button className="d0-link-btn" onClick={onEdit}>
          Edit
        </button>
      </div>
    </div>
  )
}

function SessionEditor({ session, onDone }: { session: ChatSession; onDone(): void }) {
  const editor = useEditor()
  const [name, setName] = useState(session.name)
  const [url, setUrl] = useState(session.url)
  const [notes, setNotes] = useState(session.notes)
  return (
    <form
      className="d0-session d0-session--editing"
      onSubmit={(e) => {
        e.preventDefault()
        updateSession(editor, session.id, { name: name.trim() || session.name, url: url.trim(), notes })
        onDone()
      }}
    >
      <input className="d0-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" autoFocus />
      <input className="d0-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Session URL" />
      <textarea className="d0-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
      <div className="d0-row">
        <button className="d0-btn d0-btn--primary" type="submit">
          Save
        </button>
        <button className="d0-btn" type="button" onClick={onDone}>
          Cancel
        </button>
        <span className="d0-spacer" />
        <button
          className="d0-btn d0-btn--danger"
          type="button"
          onClick={() => {
            if (window.confirm(`Delete session “${session.name}”? Cards stay on the canvas.`)) {
              deleteSession(editor, session.id)
              onDone()
            }
          }}
        >
          {Icon.trash} Delete
        </button>
      </div>
    </form>
  )
}
