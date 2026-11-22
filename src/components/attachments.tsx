import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import type { Attachment, AttachmentKind } from '../types'
import { extensionTag, formatBytes, hasFiles, KIND_LABEL } from '../lib/files'
import { Icon, type IconName } from './ui'

const KIND_ICON: Record<AttachmentKind, IconName> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  pdf: 'file',
  text: 'note',
  other: 'file',
}

/* ---------- Placeholder art ---------- */

/**
 * The stand-in image for a file with no thumbnail: a folded sheet tinted by kind,
 * with the kind's icon and the file's extension. Images whose thumbnail failed use it too.
 */
export function AttachmentArt({ kind, fileName, size = 'md' }: { kind: AttachmentKind; fileName: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`file-art file-art--${kind} file-art--${size}`} aria-hidden="true">
      <svg className="file-art__sheet" viewBox="0 0 48 60">
        <path d="M6 2h26l14 14v36a6 6 0 0 1-6 6H6a6 6 0 0 1-6-6V8a6 6 0 0 1 6-6z" transform="translate(1 0)" />
        <path className="file-art__fold" d="M33 2v10a5 5 0 0 0 5 5h9" />
      </svg>
      <span className="file-art__icon">
        <Icon name={KIND_ICON[kind]} size={size === 'sm' ? 14 : size === 'lg' ? 26 : 18} />
      </span>
      {size !== 'sm' && <span className="file-art__tag mono">{extensionTag(fileName, kind)}</span>}
    </span>
  )
}

/* ---------- Hover preview ---------- */

const PREVIEW_MAX = 420
const GAP = 14

/**
 * Wraps a link to an image: hovering (or focusing) it shows a larger version of the
 * thumbnail beside it. Rendered in a portal so cards and modals don't clip it.
 */
export function HoverPreview({ attachment, children }: { attachment: Attachment; children: ReactNode }) {
  const trigger = useRef<HTMLSpanElement>(null)
  const timer = useRef<number>(undefined)
  const [pos, setPos] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const src = attachment.thumbnailUrl

  const show = () => {
    if (!src) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const el = trigger.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const ratio = attachment.width && attachment.height ? attachment.width / attachment.height : 16 / 10
      const width = Math.round(Math.min(PREVIEW_MAX, PREVIEW_MAX * ratio, window.innerWidth - 2 * GAP))
      const height = Math.round(width / ratio)
      const vw = window.innerWidth
      const vh = window.innerHeight
      // Prefer the right of the trigger, then the left, then below it.
      let left = r.right + GAP
      if (left + width > vw - GAP) left = r.left - GAP - width
      if (left < GAP) left = Math.max(GAP, Math.min(vw - width - GAP, r.left))
      let top = r.top + r.height / 2 - height / 2 - 18
      top = Math.max(GAP, Math.min(vh - height - 48, top))
      setPos({ left, top, width, height })
    }, 120)
  }
  const hide = () => {
    window.clearTimeout(timer.current)
    setPos(null)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <span ref={trigger} className="hover-preview" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {createPortal(
        <AnimatePresence>
          {pos && src && (
            <motion.figure
              className="hover-preview__panel"
              style={{ left: pos.left, top: pos.top, width: pos.width }}
              initial={{ opacity: 0, scale: 0.96, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
              transition={{ type: 'spring', stiffness: 520, damping: 34 }}
            >
              <img src={src} alt="" width={pos.width} height={pos.height} />
              <figcaption>
                <span>{attachment.fileName}</span>
                <span className="mono">
                  {attachment.width && attachment.height ? `${attachment.width}×${attachment.height} · ` : ''}
                  {formatBytes(attachment.size)}
                </span>
              </figcaption>
            </motion.figure>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </span>
  )
}

/* ---------- Tiles ---------- */

/** Thumbnail for images, placeholder art for everything else. */
export function AttachmentThumb({ attachment, size = 'md' }: { attachment: Attachment; size?: 'sm' | 'md' }) {
  const [broken, setBroken] = useState(false)
  if (attachment.thumbnailUrl && !broken) {
    return <img className="att-thumb" src={attachment.thumbnailUrl} alt="" loading="lazy" onError={() => setBroken(true)} />
  }
  return <AttachmentArt kind={attachment.kind} fileName={attachment.fileName} size={size} />
}

interface TileProps {
  attachment: Attachment
  /** Editor actions. Omit for read-only tiles. */
  onRemove?: () => void
  onInsert?: () => void
}

/** One attachment: preview, name and size, opening the file in a new tab. Images preview larger on hover. */
export function AttachmentTile({ attachment, onRemove, onInsert }: TileProps) {
  const link = (
    <a className="att-tile__link" href={attachment.url} target="_blank" rel="noreferrer" title={`Open ${attachment.fileName}`}>
      <span className="att-tile__preview">
        <AttachmentThumb attachment={attachment} />
      </span>
      <span className="att-tile__meta">
        <span className="att-tile__name">{attachment.fileName}</span>
        <span className="att-tile__info mono">
          {KIND_LABEL[attachment.kind]} · {formatBytes(attachment.size)}
        </span>
      </span>
    </a>
  )
  return (
    <motion.li
      layout
      className="att-tile"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
    >
      {attachment.kind === 'image' ? <HoverPreview attachment={attachment}>{link}</HoverPreview> : link}
      <span className="att-tile__tools">
        {onInsert && (
          <button type="button" title="Insert into the note body" aria-label={`Insert ${attachment.fileName} into the note body`} onClick={onInsert}>
            <Icon name="imageBlock" size={14} />
          </button>
        )}
        <a href={`${attachment.url}${attachment.url.startsWith('blob:') ? '' : '?download=1'}`} download={attachment.fileName} title="Download" aria-label={`Download ${attachment.fileName}`}>
          <Icon name="download" size={14} />
        </a>
        {onRemove && (
          <button type="button" title="Remove" aria-label={`Remove ${attachment.fileName}`} onClick={onRemove}>
            <Icon name="trash" size={14} />
          </button>
        )}
      </span>
    </motion.li>
  )
}

export interface PendingUpload {
  key: string
  fileName: string
  size: number
  kind: AttachmentKind
  /** 0–1. */
  progress: number
  error?: string
}

export function PendingTile({ upload, onDismiss }: { upload: PendingUpload; onDismiss?: () => void }) {
  return (
    <motion.li layout className={`att-tile att-tile--pending ${upload.error ? 'is-error' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <span className="att-tile__link">
        <span className="att-tile__preview">
          <AttachmentArt kind={upload.kind} fileName={upload.fileName} />
        </span>
        <span className="att-tile__meta">
          <span className="att-tile__name">{upload.fileName}</span>
          {upload.error ? (
            <span className="att-tile__error">{upload.error}</span>
          ) : (
            <span className="att-tile__progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(upload.progress * 100)}>
              <motion.span animate={{ width: `${Math.max(4, upload.progress * 100)}%` }} />
            </span>
          )}
        </span>
      </span>
      {upload.error && onDismiss && (
        <span className="att-tile__tools att-tile__tools--visible">
          <button type="button" title="Dismiss" aria-label="Dismiss" onClick={onDismiss}>
            <Icon name="close" size={14} />
          </button>
        </span>
      )}
    </motion.li>
  )
}

/** A strip of small previews (card view): up to `max` items, then "+N". */
export function AttachmentStrip({ attachments, max = 5 }: { attachments: Attachment[]; max?: number }) {
  if (!attachments.length) return null
  const shown = attachments.slice(0, max)
  const rest = attachments.length - shown.length
  return (
    <ul className="att-strip" aria-label="Attachments">
      {shown.map((a) => {
        const item = (
          <a href={a.url} target="_blank" rel="noreferrer" className="att-strip__item" title={a.fileName} onClick={(e) => e.stopPropagation()}>
            <AttachmentThumb attachment={a} size="sm" />
          </a>
        )
        return <li key={a.id}>{a.kind === 'image' ? <HoverPreview attachment={a}>{item}</HoverPreview> : item}</li>
      })}
      {rest > 0 && <li className="att-strip__more mono">+{rest}</li>}
    </ul>
  )
}

/* ---------- Drop zone ---------- */

/**
 * Drag files here or click to choose them. Any number at once; `onFiles` gets them all.
 */
export function Dropzone({
  onFiles,
  disabled,
  title = 'Drop files here',
  hint = 'or click to choose. Images, video, audio, PDF and text files — as many as you like.',
  accept,
  compact,
}: {
  onFiles: (files: File[]) => void
  disabled?: boolean
  title?: ReactNode
  hint?: ReactNode
  accept?: string
  compact?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const id = useId()
  const [over, setOver] = useState(false)
  const depth = useRef(0)

  const onDragEnter = (e: DragEvent) => {
    if (!hasFiles(e) || disabled) return
    e.preventDefault()
    depth.current++
    setOver(true)
  }
  const onDragLeave = () => {
    depth.current = Math.max(0, depth.current - 1)
    if (!depth.current) setOver(false)
  }
  const onDrop = (e: DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    e.stopPropagation()
    depth.current = 0
    setOver(false)
    if (disabled) return
    const files = [...e.dataTransfer.files]
    if (files.length) onFiles(files)
  }

  return (
    <div
      className={`dropzone ${over ? 'is-over' : ''} ${compact ? 'dropzone--compact' : ''} ${disabled ? 'is-disabled' : ''}`}
      onDragEnter={onDragEnter}
      onDragOver={(e) => hasFiles(e) && !disabled && e.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <label htmlFor={id} className="dropzone__label">
        <span className="dropzone__icon">
          <Icon name="upload" size={compact ? 16 : 20} />
        </span>
        <span className="dropzone__text">
          <strong>{over ? 'Release to upload' : title}</strong>
          {!compact && <span>{hint}</span>}
        </span>
      </label>
      <input
        ref={input}
        id={id}
        type="file"
        multiple
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          if (files.length) onFiles(files)
        }}
      />
    </div>
  )
}
