import type { Editor, JsonObject } from 'tldraw'

/**
 * A Claude Code chat session. Sessions are stored in the tldraw document's `meta`,
 * so they persist with the canvas and are included in JSON exports.
 */
export interface ChatSession {
  id: string
  name: string
  /** Link back to the conversation, e.g. https://claude.ai/code/session_... */
  url: string
  createdAt: number
  notes: string
}

const META_KEY = 'defact0Sessions'

export function getSessions(editor: Editor): ChatSession[] {
  const raw = editor.getDocumentSettings().meta?.[META_KEY]
  return Array.isArray(raw) ? (raw as unknown as ChatSession[]) : []
}

function writeSessions(editor: Editor, sessions: ChatSession[]) {
  const doc = editor.getDocumentSettings()
  editor.updateDocumentSettings({
    meta: { ...doc.meta, [META_KEY]: sessions as unknown as JsonObject[] },
  })
}

export function createSession(editor: Editor, input: Partial<ChatSession> & { name: string }): ChatSession {
  const session: ChatSession = {
    id: `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    url: '',
    notes: '',
    createdAt: Date.now(),
    ...input,
  }
  writeSessions(editor, [...getSessions(editor), session])
  return session
}

export function updateSession(editor: Editor, id: string, patch: Partial<ChatSession>) {
  writeSessions(
    editor,
    getSessions(editor).map((s) => (s.id === id ? { ...s, ...patch, id } : s))
  )
}

export function deleteSession(editor: Editor, id: string) {
  editor.run(() => {
    writeSessions(
      editor,
      getSessions(editor).filter((s) => s.id !== id)
    )
    const cards = editor
      .getCurrentPageShapes()
      .filter((s) => s.type === 'card' && s.props.sessionId === id)
    editor.updateShapes(cards.map((c) => ({ id: c.id, type: 'card' as const, props: { sessionId: '' } })))
  })
}

/** A stable, pleasant color for a session id. */
export function sessionColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 70% 62%)`
}

/** Pull a plausible session title out of a pasted Claude Code URL. */
export function guessSessionName(url: string): string {
  const m = url.match(/session[_-]([A-Za-z0-9]+)/)
  return m ? `Session ${m[1].slice(0, 8)}` : ''
}
