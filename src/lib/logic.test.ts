import { describe, expect, it } from 'vitest'
import { clusterLayout, gridLayout, groupByAssignment, kMeans, suggestK } from './arrange'
import { detectCode, isTextLikeFile, languageFromFilename, stripFence, titleFromText } from './detect'
import { containsWord, extractKeywords, frameNameFor, planOrganize } from './organize'
import { emptyQuery, parseTags, search, tagCounts, type SearchItem } from './search'

const item = (id: string, p: Partial<SearchItem> = {}): SearchItem => ({
  id, kind: 'card', title: '', text: '', tags: [], sessionId: '', createdAt: 0, ...p,
})

describe('arrange', () => {
  it('lays out a near-square grid without overlaps', () => {
    const boxes = Array.from({ length: 5 }, (_, i) => ({ id: String(i), w: 100, h: 50 + i * 10 }))
    const out = gridLayout(boxes, { x: 10, y: 20 }, { gap: 8 })
    expect(out.map((p) => [p.x, p.y])).toEqual([[10, 20], [118, 20], [226, 20], [10, 98], [118, 98]])
  })
  it('stacks clusters vertically', () => {
    const { placements, bounds } = clusterLayout([[{ id: 'a', w: 10, h: 10 }], [{ id: 'b', w: 10, h: 10 }]], { x: 0, y: 0 }, { clusterGap: 50 })
    expect(placements).toEqual([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 0, y: 60 }])
    expect(bounds).toHaveLength(2)
  })
  it('k-means separates obvious groups deterministically', () => {
    const v = [[0, 0], [10, 10], [0.1, 0], [10, 9.9], [0, 0.2]]
    const a = kMeans(v, 2)
    expect(a[0]).toBe(a[2]); expect(a[0]).toBe(a[4]); expect(a[1]).toBe(a[3]); expect(a[0]).not.toBe(a[1])
    expect(groupByAssignment(['a', 'b', 'c', 'd', 'e'], a)).toEqual([['a', 'c', 'e'], ['b', 'd']])
    expect(suggestK(1)).toBe(1); expect(suggestK(200)).toBe(8)
  })
})

describe('detect', () => {
  it('maps extensions, including .ts reported as video', () => {
    expect(languageFromFilename('auth.ts')).toBe('typescript')
    expect(isTextLikeFile({ name: 'auth.ts', type: 'video/mp2t' })).toBe(true)
    expect(isTextLikeFile({ name: 'shot.png', type: 'image/png' })).toBe(false)
    expect(isTextLikeFile({ name: 'notes', type: 'text/plain' })).toBe(true)
  })
  it('detects code and language', () => {
    expect(detectCode('```python\nprint(1)\n```')).toEqual({ isCode: true, language: 'python' })
    expect(detectCode('{"a": 1}').language).toBe('json')
    expect(detectCode('const x = (a) => a + 1;\nexport default x;').isCode).toBe(true)
    expect(detectCode('Remember to check the login page tomorrow.').isCode).toBe(false)
  })
  it('strips fences and makes titles', () => {
    expect(stripFence('```ts\nlet a = 1\n```')).toBe('let a = 1')
    expect(titleFromText('\n// Auth helper\nfoo()')).toBe('Auth helper')
  })
})

describe('search', () => {
  const items = [
    item('1', { title: 'Login screen', tags: ['auth flow'], createdAt: 100 }),
    item('2', { text: 'stack trace from login bug', tags: ['bug'], createdAt: 200, sessionId: 's1' }),
    item('3', { title: 'Dashboard', createdAt: 300 }),
  ]
  it('ranks title hits above body hits and ANDs terms', () => {
    expect(search(items, { ...emptyQuery, text: 'login' }).map((i) => i.id)).toEqual(['1', '2'])
    expect(search(items, { ...emptyQuery, text: 'login bug' }).map((i) => i.id)).toEqual(['2'])
  })
  it('filters by tag, date and session', () => {
    expect(search(items, { ...emptyQuery, tags: ['bug'] }).map((i) => i.id)).toEqual(['2'])
    expect(search(items, { ...emptyQuery, from: 150, to: 250 }).map((i) => i.id)).toEqual(['2'])
    expect(search(items, { ...emptyQuery, sessionId: 's1' }).map((i) => i.id)).toEqual(['2'])
  })
  it('parses and counts tags', () => {
    expect(parseTags(' Auth Flow, #bug,bug ,, ')).toEqual(['auth flow', 'bug'])
    expect(tagCounts(items)).toEqual([{ tag: 'auth flow', count: 1 }, { tag: 'bug', count: 1 }])
  })
})

describe('organize stub', () => {
  const items = [
    item('a', { title: 'OAuth callback screenshot' }),
    item('b', { text: 'jwt.verify(token)' }),
    item('c', { title: 'Build pipeline' }),
    item('d', { tags: ['login'] }),
  ]
  it('expands synonyms and ignores filler words', () => {
    expect(extractKeywords('group all the authentication related screenshots together')).toEqual(['authentication'])
    expect(planOrganize('group all the authentication related screenshots together', items).ids).toEqual(['a', 'b', 'd'])
  })
  it('matches at word starts only', () => {
    expect(containsWord('build pipeline', 'ui')).toBe(false)
    expect(containsWord('new ui layout', 'ui')).toBe(true)
  })
  it('names frames', () => {
    expect(frameNameFor('collect bugs into a frame called "Bug bash"', [])).toBe('Bug bash')
    expect(frameNameFor('x', ['api', 'design'])).toBe('Api Design')
  })
})
