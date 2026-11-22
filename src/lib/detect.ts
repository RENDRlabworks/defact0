/** Heuristics for classifying pasted/dropped text. Pure, unit tested. */

const EXT_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx', mjs: 'javascript', cjs: 'javascript',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java', kt: 'kotlin', swift: 'swift',
  c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cs: 'csharp', php: 'php', sh: 'bash', bash: 'bash', zsh: 'bash',
  sql: 'sql', json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml', xml: 'xml', html: 'html',
  css: 'css', scss: 'scss', md: 'markdown', mdx: 'markdown', diff: 'diff', patch: 'diff',
  graphql: 'graphql', gql: 'graphql', vue: 'vue', svelte: 'svelte', dockerfile: 'dockerfile',
  mmd: 'mermaid', log: 'log', txt: '', csv: 'csv', env: '', ini: 'ini',
}

export function languageFromFilename(name: string): string | null {
  const lower = name.toLowerCase()
  if (lower === 'dockerfile' || lower === 'makefile') return lower
  const ext = lower.split('.').pop() ?? ''
  return ext in EXT_LANG ? EXT_LANG[ext] : null
}

/** True if a dropped file should be read as text and turned into a snippet card. */
export function isTextLikeFile(file: { name: string; type: string }): boolean {
  if (languageFromFilename(file.name) !== null) return true
  if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')) return false
  if (file.type.startsWith('text/')) return true
  return /json|xml|javascript|typescript|yaml|x-sh|sql|toml/.test(file.type)
}

const CODE_SIGNALS: RegExp[] = [
  /^\s*(import|export|from|const|let|var|function|class|interface|type|def|fn|pub|package|func|return|async|await)\b/m,
  /[{};]\s*$/m,
  /=>|::|->|\+\+|\|\||&&/,
  /^\s*(#include|#!\/|<\?php|SELECT |INSERT |CREATE TABLE)/im,
  /^\s*[$>] \S+/m,
  /^\s{2,}\S/m,
  /^[+-]{1}[^+-]/m,
  /<\/?[a-z][\w-]*(\s[^>]*)?>/i,
]

/** Rough guess of whether text is code, and which language. */
export function detectCode(text: string): { isCode: boolean; language: string } {
  const trimmed = text.trim()
  const fence = trimmed.match(/^```([\w+-]*)\n/)
  if (fence) return { isCode: true, language: fence[1] || '' }
  if (/^\s*[{[]/.test(trimmed)) {
    try {
      JSON.parse(trimmed)
      return { isCode: true, language: 'json' }
    } catch {
      /* not json */
    }
  }
  const hits = CODE_SIGNALS.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0)
  const isCode = hits >= 2
  let language = ''
  if (isCode) {
    if (/\binterface\b|: (string|number|boolean)\b|\btype \w+ =/.test(text)) language = 'typescript'
    else if (/\bdef \w+\(|^\s*import \w+$|\bself\b/m.test(text)) language = 'python'
    else if (/\bfunc \w+\(|\bpackage main\b/.test(text)) language = 'go'
    else if (/\bfn \w+\(|\blet mut\b/.test(text)) language = 'rust'
    else if (/^\s*[$>] /m.test(text)) language = 'bash'
    else if (/\b(const|let|=>|function)\b/.test(text)) language = 'javascript'
    else if (/^\s*(SELECT|INSERT|UPDATE|CREATE)\b/im.test(text)) language = 'sql'
  }
  return { isCode, language }
}

/** Strip a surrounding markdown code fence, if any. */
export function stripFence(text: string): string {
  const m = text.trim().match(/^```[\w+-]*\n([\s\S]*?)\n?```$/)
  return m ? m[1] : text
}

/** A short title from the first meaningful line. */
export function titleFromText(text: string, max = 48): string {
  const line = text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !/^```/.test(l))
  if (!line) return ''
  const clean = line.replace(/^#+\s*/, '').replace(/^(\/\/|#|--|\/\*+)\s*/, '')
  return clean.length > max ? clean.slice(0, max - 1) + '…' : clean
}
