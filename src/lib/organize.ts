import { normalizeTag, type SearchItem } from './search'

/**
 * "AI organize" stub. Turns an instruction like
 *   "group all the authentication related screenshots together"
 * into a frame name and a set of matching items, using keyword + synonym matching.
 *
 * The interface (instruction + items in, {frameName, ids} out) is shaped so a real
 * LLM call can replace `planOrganize` later without touching the UI.
 */
export interface OrganizePlan {
  frameName: string
  keywords: string[]
  ids: string[]
}

const STOP_WORDS = new Set(
  (
    'a an the all any every of to for in on at by with and or into together group put move collect gather ' +
    'related relating regarding about stuff things items cards screenshots screenshot images image shots ' +
    'pictures snippets snippet code notes note diagrams diagram please them these those that this my me ' +
    'new frame frames cluster called named organize sort arrange everything which are is be'
  ).split(' ')
)

/** Small synonym table so "authentication" also finds "login", "oauth", "jwt"... */
const SYNONYMS: Record<string, string[]> = {
  auth: ['auth', 'authentication', 'login', 'logout', 'signin', 'sign-in', 'signup', 'oauth', 'jwt', 'token', 'password', 'sso'],
  bug: ['bug', 'bugs', 'error', 'exception', 'crash', 'stack', 'traceback', 'failing', 'fail', 'broken'],
  frontend: ['frontend', 'front-end', 'ui', 'react', 'css', 'component', 'tsx', 'jsx', 'layout', 'button', 'page'],
  backend: ['backend', 'back-end', 'server', 'database', 'db', 'sql', 'query', 'migration', 'endpoint'],
  api: ['api', 'endpoint', 'rest', 'graphql', 'request', 'response', 'http', 'route', 'schema'],
  test: ['test', 'tests', 'testing', 'spec', 'jest', 'vitest', 'playwright', 'assert', 'coverage'],
  deploy: ['deploy', 'deployment', 'ci', 'build', 'pipeline', 'docker', 'release', 'vercel'],
  design: ['design', 'mockup', 'figma', 'wireframe', 'style', 'color', 'typography'],
  perf: ['perf', 'performance', 'slow', 'latency', 'profile', 'memory', 'benchmark'],
}

const ROOTS: [string, string][] = [
  ['authent', 'auth'],
  ['authori', 'auth'],
  ['login', 'auth'],
  ['bug', 'bug'],
  ['error', 'bug'],
  ['front', 'frontend'],
  ['back', 'backend'],
  ['api', 'api'],
  ['test', 'test'],
  ['deploy', 'deploy'],
  ['design', 'design'],
  ['perf', 'perf'],
]

export function extractKeywords(instruction: string): string[] {
  const words = instruction
    .toLowerCase()
    .replace(/["'“”‘’]/g, ' ')
    .split(/[^a-z0-9#\-_.]+/)
    .map((w) => w.replace(/^#/, '').replace(/^[-_.]+|[-_.]+$/g, ''))
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
  return [...new Set(words)]
}

export function expandKeyword(word: string): string[] {
  for (const [prefix, key] of ROOTS) if (word.startsWith(prefix)) return SYNONYMS[key]
  for (const list of Object.values(SYNONYMS)) if (list.includes(word)) return list
  return [word]
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Word-start match, so "ui" does not match "build" but "auth" does match "authService". */
export function containsWord(haystack: string, term: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(term.toLowerCase())}`, 'i').test(haystack)
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Pick a frame name: an explicit `called "X"` / `named X` wins, else the keywords. */
export function frameNameFor(instruction: string, keywords: string[]): string {
  const named = instruction.match(/(?:called|named|into|as)\s+["“']([^"”']+)["”']/i)
  if (named) return named[1].trim()
  return keywords.length ? titleCase(keywords.slice(0, 3).join(' ')) : 'Organized'
}

export function planOrganize(instruction: string, items: SearchItem[]): OrganizePlan {
  const keywords = extractKeywords(instruction)
  const groups = keywords.map(expandKeyword)
  const ids = items
    .filter((item) => {
      if (!groups.length) return false
      // An item matches if it hits any synonym of any keyword group.
      const hay = `${item.title}\n${item.text}`.toLowerCase()
      return groups.some((syns) => syns.some((term) => item.tags.includes(normalizeTag(term)) || containsWord(hay, term)))
    })
    .map((i) => i.id)
  return { frameName: frameNameFor(instruction, keywords), keywords, ids }
}
