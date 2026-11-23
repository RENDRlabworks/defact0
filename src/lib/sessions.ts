import type { Editor } from '../engine/Editor'
import { uid } from '../engine/Editor'
import type { ChatSession } from '../engine/types'

export type { ChatSession }
export { sessionColor } from '../engine/render/ShapeViews'

export const getSessions = (editor: Editor) => editor.doc.get().sessions

export function createSession(editor: Editor, input: Partial<ChatSession> & { name: string }): ChatSession {
  const session: ChatSession = { id: uid('session'), url: '', notes: '', createdAt: Date.now(), ...input }
  editor.setSessions((s) => [...s, session])
  return session
}

export function updateSession(editor: Editor, id: string, patch: Partial<ChatSession>) {
  editor.setSessions((all) => all.map((s) => (s.id === id ? { ...s, ...patch, id } : s)))
}

export function deleteSession(editor: Editor, id: string) {
  editor.run(() => {
    editor.setSessions((all) => all.filter((s) => s.id !== id))
    editor.updateShapes(editor.getShapes().filter((s) => s.sessionId === id).map((s) => ({ id: s.id, sessionId: '' })))
  })
}

/** Pull a plausible session title out of a pasted Claude Code URL. */
export function guessSessionName(url: string): string {
  const m = url.match(/session[_-]([A-Za-z0-9]+)/)
  return m ? `Session ${m[1].slice(0, 8)}` : ''
}
