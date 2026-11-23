/** Pure search + filter logic over a flat index of canvas items. */

export interface SearchItem {
  id: string
  kind: 'card' | 'note' | 'text' | 'frame' | 'other'
  title: string
  text: string
  tags: string[]
  sessionId: string
  createdAt: number
}

export interface SearchQuery {
  text: string
  tags: string[]
  /** Inclusive range, epoch ms. null means unbounded. */
  from: number | null
  to: number | null
  sessionId: string | null
}

export const emptyQuery: SearchQuery = { text: '', tags: [], from: null, to: null, sessionId: null }

export function normalizeTag(tag: string) {
  return tag.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, ' ')
}

/** Parse "auth flow, #bug  frontend" style input into clean, unique tags. */
export function parseTags(input: string): string[] {
  const out: string[] = []
  for (const raw of input.split(/[,\n]/)) {
    const t = normalizeTag(raw)
    if (t && !out.includes(t)) out.push(t)
  }
  return out
}

/**
 * Score an item against free text. Every whitespace-separated term must appear
 * somewhere (AND semantics). Title and tag hits score higher than body hits.
 * Returns 0 for no match.
 */
export function scoreItem(item: SearchItem, text: string): number {
  const terms = text.toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return 1
  const title = item.title.toLowerCase()
  const body = item.text.toLowerCase()
  const tags = item.tags.join(' ').toLowerCase()
  let score = 0
  for (const term of terms) {
    let s = 0
    if (title.includes(term)) s += 3
    if (tags.includes(term)) s += 2
    if (body.includes(term)) s += 1
    if (!s) return 0
    score += s
  }
  return score
}

export function matchesFilters(item: SearchItem, q: SearchQuery): boolean {
  if (q.tags.length && !q.tags.every((t) => item.tags.includes(t))) return false
  if (q.from != null && item.createdAt < q.from) return false
  if (q.to != null && item.createdAt > q.to) return false
  if (q.sessionId != null && item.sessionId !== q.sessionId) return false
  return true
}

export function search(items: SearchItem[], q: SearchQuery): SearchItem[] {
  return items
    .filter((i) => matchesFilters(i, q))
    .map((i) => ({ i, s: scoreItem(i, q.text) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || b.i.createdAt - a.i.createdAt)
    .map((r) => r.i)
}

export function isQueryEmpty(q: SearchQuery) {
  return !q.text.trim() && !q.tags.length && q.from == null && q.to == null && q.sessionId == null
}

/** All tags in use, most common first. */
export function tagCounts(items: SearchItem[]): { tag: string; count: number }[] {
  const m = new Map<string, number>()
  for (const i of items) for (const t of i.tags) m.set(t, (m.get(t) ?? 0) + 1)
  return [...m.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}
