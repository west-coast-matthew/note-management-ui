import type { ReactNode } from 'react'
import { motion } from 'motion/react'

/** The "/ WHAT /" eyebrow label from the reference. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="eyebrow mono">
      <span>/</span> {children} <span>/</span>
    </div>
  )
}

/** Dashed annotation frame with orange corner nodes. */
export function Annotated({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`annotated ${className}`}>
      <i className="annotated__dot annotated__dot--tl" />
      <i className="annotated__dot annotated__dot--tr" />
      <i className="annotated__dot annotated__dot--bl" />
      <i className="annotated__dot annotated__dot--br" />
      {children}
    </div>
  )
}

/** Two-state switch styled after the Monthly / Yearly toggle. */
export function Toggle<T extends string>({
  left,
  right,
  value,
  onChange,
}: {
  left: { value: T; label: string }
  right: { value: T; label: string }
  value: T
  onChange: (v: T) => void
}) {
  const isRight = value === right.value
  return (
    <div className="toggle">
      <button type="button" className={`toggle__label ${!isRight ? 'is-active' : ''}`} onClick={() => onChange(left.value)}>
        {left.label}
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={isRight}
        aria-label={`Sort: ${isRight ? right.label : left.label}`}
        className="toggle__track"
        onClick={() => onChange(isRight ? left.value : right.value)}
        style={{ justifyContent: isRight ? 'flex-end' : 'flex-start' }}
      >
        <motion.span layout className="toggle__knob" transition={{ type: 'spring', stiffness: 700, damping: 32 }} />
      </button>
      <button type="button" className={`toggle__label ${isRight ? 'is-active' : ''}`} onClick={() => onChange(right.value)}>
        {right.label}
      </button>
    </div>
  )
}

const paths = {
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  chevron: 'M9 6l6 6-6 6',
  arrow: 'M7 17L17 7M8 7h9v9',
  globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
  folder: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  close: 'M6 6l12 12M18 6L6 18',
  spark: 'M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4',
  check: 'M5 12l5 5 9-10',
  alert: 'M12 3.5l9 16H3l9-16zM12 10v4.5M12 17.25v.01',
  link: 'M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1 1M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1-1',
  import: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 15v3a2 2 0 002 2h10a2 2 0 002-2v-3',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  note: 'M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zM14 3v5h5M9 13h6M9 17h4',
  file: 'M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zM14 3v5h5',
  paperclip: 'M20 11.5l-8.2 8.2a5 5 0 01-7.1-7.1l8.5-8.5a3.3 3.3 0 014.7 4.7l-8.5 8.5a1.7 1.7 0 01-2.4-2.4l7.8-7.8',
  upload: 'M12 15V4M7.5 8.5L12 4l4.5 4.5M5 15v3a2 2 0 002 2h10a2 2 0 002-2v-3',
  download: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 15v3a2 2 0 002 2h10a2 2 0 002-2v-3',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01',
  video: 'M4 6h11v12H4zM15 10l5-3v10l-5-3',
  audio: 'M9 18V6l10-2v12M9 18a3 3 0 11-6 0 3 3 0 016 0zM19 16a3 3 0 11-6 0 3 3 0 016 0z',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
  bold: 'M7 5h6a3.5 3.5 0 010 7H7zM7 12h7a3.5 3.5 0 010 7H7z',
  italic: 'M10 5h8M6 19h8M14 5l-4 14',
  underline: 'M7 4v7a5 5 0 0010 0V4M5 20h14',
  strike: 'M5 12h14M16 7a4 3 0 00-4-2c-2.5 0-4 1.3-4 3 0 3.5 8 2.5 8 6.5 0 1.8-1.7 3.5-4.5 3.5A5 5 0 017 16',
  code: 'M9 8l-4 4 4 4M15 8l4 4-4 4',
  codeBlock: 'M4 5h16v14H4zM9.5 10l-2 2 2 2M14.5 10l2 2-2 2',
  quote: 'M7 7h4v4c0 3-2 5-4 6M14 7h4v4c0 3-2 5-4 6',
  orderedList: 'M10 6h10M10 12h10M10 18h10M4 4.5h1.5V9M4 9h3M4 14.5c0-.8.7-1.5 1.5-1.5S7 13.7 7 14.5c0 1.5-3 2-3 4h3',
  rule: 'M4 12h16',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3',
  imageBlock: 'M4 4h16v10H4zM4 18h16M4 21h10',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  copySelection: 'M9 9h10v11H9zM5 15V4h10M12 13h4M12 16h2.5',
  imageInline: 'M3 7h7v7H3zM13 8h8M13 12h8M3 18h18',
}

export type IconName = keyof typeof paths

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}

export function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const units: [number, string][] = [
    [60, 'm'],
    [24, 'h'],
    [7, 'd'],
    [4.35, 'w'],
    [12, 'mo'],
    [Infinity, 'y'],
  ]
  let n = s / 60
  for (const [size, label] of units) {
    if (n < size) return `${Math.floor(n)}${label} ago`
    n /= size
  }
  return ''
}
