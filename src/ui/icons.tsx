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
  cursor: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <path d="M3.5 2.5 12 8l-3.8.8 2.1 4-1.6.8-2.1-4L3.5 12.3z" />
    </svg>
  ),
  hand: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <path d="M5.5 8V3.5a1 1 0 0 1 2 0V7M7.5 7V2.5a1 1 0 0 1 2 0V7M9.5 7V3.5a1 1 0 0 1 2 0V9c0 3-1.8 5-4.3 5C5 14 4 12.6 3 10.8L2 9a1 1 0 0 1 1.7-1l1.8 1.8" />
    </svg>
  ),
  pencil: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <path d="M10.5 2.5 13.5 5.5 6 13H3v-3zM9 4l3 3" />
    </svg>
  ),
  note: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <path d="M2.5 3.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1V10l-3.5 3.5H3.5a1 1 0 0 1-1-1zM13.5 10H11a1 1 0 0 0-1 1v2.5" />
    </svg>
  ),
  card: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
      <path d="M2 5.5h12M4.5 8.5l1.5 1.2-1.5 1.3M7.5 11h3" />
    </svg>
  ),
  image: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
      <circle cx="5.8" cy="6" r="1.2" />
      <path d="m2.5 12 3.5-3.5 2.5 2.5 2-2 3 3" />
    </svg>
  ),
  undo: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <path d="M5.5 3.5 2.5 6.5l3 3M2.5 6.5h7a4 4 0 0 1 0 8H7" />
    </svg>
  ),
  redo: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <path d="m10.5 3.5 3 3-3 3M13.5 6.5h-7a4 4 0 0 0 0 8H9" />
    </svg>
  ),
  menu: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
    </svg>
  ),
  minus: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <path d="M3 8h10" />
    </svg>
  ),
  fit: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
    </svg>
  ),
  moon: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <path d="M13 9.5A5.5 5.5 0 1 1 6.5 3a4.5 4.5 0 0 0 6.5 6.5z" />
    </svg>
  ),
  map: (
    <svg width="16" height="16" viewBox="0 0 16 16" {...P}>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <rect x="7" y="7" width="4.5" height="3.5" rx="0.5" />
    </svg>
  ),
}
