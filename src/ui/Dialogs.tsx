import { useMemo, useState } from 'react'
import { useEditor, useValue, type TLShapeId } from 'tldraw'
import { gridLayout } from '../lib/arrange'
import { buildIndex, frameShapes, getTags, setSession, setTags } from '../lib/canvas'
import { planOrganize } from '../lib/organize'
import { parseTags, tagCounts } from '../lib/search'
import { createSession, getSessions, guessSessionName, sessionColor } from '../lib/sessions'
import { ui } from '../lib/uiState'
import { Modal, useJumpTo } from './common'

export function Dialogs() {
  const tag = useValue('tagDialog', () => ui.tagDialog.get(), [])
  const org = useValue('organizeDialog', () => ui.organizeDialog.get(), [])
  const ses = useValue('sessionDialog', () => ui.sessionDialog.get(), [])
  return (
    <>
      {tag && <TagDialog onClose={() => ui.tagDialog.set(false)} />}
      {org && <OrganizeDialog onClose={() => ui.organizeDialog.set(false)} />}
      {ses && <AssignSessionDialog onClose={() => ui.sessionDialog.set(false)} />}
    </>
  )
}

/* -------------------------------- Tags -------------------------------- */

function TagDialog({ onClose }: { onClose(): void }) {
  const editor = useEditor()
  const ids = useMemo(() => editor.getSelectedShapeIds(), [editor])
  const current = useValue(
    'sel tags',
    () => {
      const all = ids.map((id) => editor.getShape(id)).filter(Boolean).map((s) => getTags(s!))
      const union = [...new Set(all.flat())]
      return union.map((t) => ({ tag: t, all: all.every((list) => list.includes(t)) }))
    },
    [editor, ids]
  )
  const known = useMemo(() => tagCounts(buildIndex(editor)).map((t) => t.tag), [editor])
  const [input, setInput] = useState('')
  const add = (tags: string[]) => {
    if (!tags.length) return
    setTags(editor, ids, (old) => [...old, ...tags])
    setInput('')
  }
  const suggestions = known.filter((t) => !current.some((c) => c.tag === t) && t.includes(input.trim().toLowerCase())).slice(0, 12)

  return (
    <Modal title={`Tag ${ids.length} item${ids.length === 1 ? '' : 's'}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (input.trim()) add(parseTags(input))
          else onClose()
        }}
      >
        <input
          className="d0-input"
          data-autofocus
          placeholder="Add tags: auth flow, bug, frontend, API design"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
      </form>
      {current.length > 0 && (
        <div className="d0-section">
          <div className="d0-label">On selection</div>
          <div className="d0-chips">
            {current.map(({ tag, all }) => (
              <span key={tag} className={`d0-tag ${all ? '' : 'is-partial'}`} title={all ? '' : 'On some of the selected items'}>
                {tag}
                <button className="d0-tag__x" onClick={() => setTags(editor, ids, (old) => old.filter((t) => t !== tag))} aria-label={`Remove ${tag}`}>
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="d0-section">
          <div className="d0-label">Existing tags</div>
          <div className="d0-chips">
            {suggestions.map((t) => (
              <button key={t} className="d0-tag d0-tag--btn" onClick={() => add([t])}>
                + {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ------------------------------ Sessions ------------------------------ */

function AssignSessionDialog({ onClose }: { onClose(): void }) {
  const editor = useEditor()
  const ids = useMemo(() => editor.getSelectedShapeIds(), [editor])
  const sessions = useValue('sessions', () => getSessions(editor), [editor])
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const assign = (id: string) => {
    setSession(editor, ids, id)
    onClose()
  }
  return (
    <Modal title={`Assign ${ids.length} item${ids.length === 1 ? '' : 's'} to a chat session`} onClose={onClose}>
      {sessions.length > 0 && (
        <div className="d0-section">
          <div className="d0-label">Existing sessions</div>
          <div className="d0-list">
            {[...sessions].reverse().map((s) => (
              <button key={s.id} className="d0-list__item" onClick={() => assign(s.id)}>
                <i className="d0-session__dot" style={{ background: sessionColor(s.id) }} />
                {s.name}
              </button>
            ))}
            <button className="d0-list__item d0-muted" onClick={() => assign('')}>
              Remove from session
            </button>
          </div>
        </div>
      )}
      <form
        className="d0-section"
        onSubmit={(e) => {
          e.preventDefault()
          const s = createSession(editor, { name: name.trim() || guessSessionName(url) || `Session ${sessions.length + 1}`, url: url.trim() })
          assign(s.id)
        }}
      >
        <div className="d0-label">New session</div>
        <input className="d0-input" data-autofocus={sessions.length === 0 || undefined} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="d0-input" placeholder="Claude Code session URL (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button className="d0-btn d0-btn--primary" type="submit">
          Create &amp; assign
        </button>
      </form>
    </Modal>
  )
}

/* ------------------------------ Organize ------------------------------ */

const EXAMPLES = [
  'Group all the authentication related screenshots together',
  'Collect every bug and error into a frame called "Bugs"',
  'Put the frontend components together',
  'Gather API design snippets',
]

function OrganizeDialog({ onClose }: { onClose(): void }) {
  const editor = useEditor()
  const jumpTo = useJumpTo()
  const [instruction, setInstruction] = useState('')
  const index = useMemo(() => buildIndex(editor).filter((i) => i.kind !== 'frame'), [editor])
  const plan = useMemo(() => planOrganize(instruction, index), [instruction, index])

  const run = () => {
    const ids = plan.ids as TLShapeId[]
    if (!ids.length) return
    editor.markHistoryStoppingPoint('ai organize')
    // Lay matches out in a grid to the right of everything, then wrap them in a frame.
    const pageBounds = editor.getCurrentPageBounds()
    const origin = pageBounds ? { x: pageBounds.maxX + 240, y: pageBounds.minY } : editor.getViewportPageBounds().center
    let frameId: TLShapeId | null = null
    editor.run(() => {
      const boxes = ids.map((id) => {
        const b = editor.getShapePageBounds(id)!
        return { id: id as string, w: b.w, h: b.h }
      })
      const placements = gridLayout(boxes, origin, { gap: 32, columns: Math.min(4, Math.ceil(Math.sqrt(ids.length))) })
      // Pull matches out of any existing frames first so they move in page space.
      editor.reparentShapes(ids, editor.getCurrentPageId())
      editor.updateShapes(
        placements.map((p) => {
          const shape = editor.getShape(p.id as TLShapeId)!
          const b = editor.getShapePageBounds(shape.id)!
          return { id: shape.id, type: shape.type, x: shape.x + (p.x - b.x), y: shape.y + (p.y - b.y) }
        })
      )
      frameId = frameShapes(editor, ids, plan.frameName)
    })
    onClose()
    if (frameId) jumpTo([frameId])
  }

  return (
    <Modal
      title="AI organize"
      onClose={onClose}
      footer={
        <>
          <span className="d0-muted d0-small">Local keyword matcher (stub). Swap planOrganize() for an LLM call later.</span>
          <span className="d0-spacer" />
          <button className="d0-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="d0-btn d0-btn--primary" disabled={!plan.ids.length} onClick={run}>
            Move {plan.ids.length || ''} into “{plan.frameName}”
          </button>
        </>
      }
    >
      <textarea
        className="d0-input"
        data-autofocus
        rows={3}
        placeholder="Describe what to group, e.g. “group all the authentication related screenshots together”"
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run()
        }}
      />
      {!instruction && (
        <div className="d0-chips d0-section">
          {EXAMPLES.map((ex) => (
            <button key={ex} className="d0-tag d0-tag--btn" onClick={() => setInstruction(ex)}>
              {ex}
            </button>
          ))}
        </div>
      )}
      {instruction && (
        <div className="d0-section">
          <div className="d0-label">
            Keywords: {plan.keywords.join(', ') || '(none)'} · {plan.ids.length} match{plan.ids.length === 1 ? '' : 'es'}
          </div>
          <ul className="d0-match-list">
            {plan.ids.slice(0, 30).map((id) => {
              const item = index.find((i) => i.id === id)!
              return (
                <li key={id}>
                  <span className={`d0-kind d0-kind--${item.kind}`}>{item.kind}</span> {item.title || item.text.slice(0, 60) || '(untitled)'}
                </li>
              )
            })}
            {plan.ids.length > 30 && <li className="d0-muted">…and {plan.ids.length - 30} more</li>}
          </ul>
        </div>
      )}
    </Modal>
  )
}
