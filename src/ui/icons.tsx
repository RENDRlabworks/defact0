/** Minimal stroke icons (16px, currentColor). */
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export const Icon = {
  search: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 14 14" />
    </svg>
  ),
  sessions: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <path d="M2.5 4.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H7l-3 3v-3h0.5a2 2 0 0 1-2-2z" />
    </svg>
  ),
  sparkle: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l1.5 1.5M10.5 10.5 12 12M12 4l-1.5 1.5M5.5 10.5 4 12" />
    </svg>
  ),
  tag: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <path d="M2.5 8.2V3.5a1 1 0 0 1 1-1h4.7l5.3 5.3a1 1 0 0 1 0 1.4l-4.3 4.3a1 1 0 0 1-1.4 0z" />
      <circle cx="5.5" cy="5.5" r="0.9" />
    </svg>
  ),
  grid: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
    </svg>
  ),
  download: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" />
    </svg>
  ),
  close: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  ),
  link: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <path d="M7 9a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-.8.8M9 7a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l.8-.8" />
    </svg>
  ),
  target: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <circle cx="8" cy="8" r="5" />
      <circle cx="8" cy="8" r="1.5" />
    </svg>
  ),
  frame: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <path d="M4.5 1.5v13M11.5 1.5v13M1.5 4.5h13M1.5 11.5h13" />
    </svg>
  ),
  chevronLeft: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <path d="M10 3 5 8l5 5" />
    </svg>
  ),
  chevronRight: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <path d="m6 3 5 5-5 5" />
    </svg>
  ),
  trash: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4" />
    </svg>
  ),
  plus: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <path d="M8 3v10M3 8h10" />
    </svg>
  ),
  copy: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <rect x="5" y="5" width="8.5" height="8.5" rx="1.5" />
      <path d="M11 5V3.5A1 1 0 0 0 10 2.5H3.5a1 1 0 0 0-1 1V10a1 1 0 0 0 1 1H5" />
    </svg>
  ),
}
