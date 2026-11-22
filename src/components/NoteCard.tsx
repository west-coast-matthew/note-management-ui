import { forwardRef, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { motion } from 'motion/react'
import type { Note } from '../types'
import { hasFiles } from '../lib/files'
import { plainText } from '../lib/html'
import { AttachmentStrip } from './attachments'
import { Icon, timeAgo } from './ui'

export interface NoteItemProps {
  note: Note
  path: string[]
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
  /** Files dropped onto the note are attached to it. */
  onDropFiles: (files: File[]) => void
  /** Saving / error text for this note's requests. */
  status?: ReactNode
}

/** Drag-and-drop handling shared by cards and rows. */
export function useFileDrop(onDropFiles: (files: File[]) => void) {
  const [over, setOver] = useState(false)
  const depth = useRef(0)
  return {
    over,
    handlers: {
      onDragEnter: (e: DragEvent) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        depth.current++
        setOver(true)
      },
      onDragOver: (e: DragEvent) => hasFiles(e) && e.preventDefault(),
      onDragLeave: () => {
        depth.current = Math.max(0, depth.current - 1)
        if (!depth.current) setOver(false)
      },
      onDrop: (e: DragEvent) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        e.stopPropagation()
        depth.current = 0
        setOver(false)
        onDropFiles([...e.dataTransfer.files])
      },
    },
  }
}

export const NoteCard = forwardRef<HTMLElement, NoteItemProps>(function NoteCard({ note, path, onOpen, onEdit, onDelete, onDropFiles, status }, ref) {
  const { over, handlers } = useFileDrop(onDropFiles)
  const listed = note.attachments.filter((a) => !a.embedded)
  const excerpt = note.summary || plainText(note.body)

  return (
    <motion.article
      ref={ref}
      layout
      className={`card note-card ${over ? 'is-drop-target' : ''}`}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      {...handlers}
    >
      <div className="card__body">
        <header className="card__head">
          <h3 className="card__title">
            <button type="button" className="note-card__open" onClick={onOpen}>
              {note.title}
            </button>
          </h3>
          <span className="card__tools">
            <button type="button" title="Edit note" aria-label={`Edit ${note.title}`} onClick={onEdit}>
              <Icon name="edit" size={15} />
            </button>
            <button type="button" title="Delete note" aria-label={`Delete ${note.title}`} onClick={onDelete}>
              <Icon name="trash" size={15} />
            </button>
          </span>
        </header>
        {excerpt ? <p className={`card__desc ${note.summary ? '' : 'card__desc--excerpt'}`}>{excerpt}</p> : <p className="card__desc card__desc--empty">Empty note</p>}
        {listed.length > 0 && (
          <div className="note-card__files">
            <AttachmentStrip attachments={listed} />
          </div>
        )}
        {status && <div className="card__status">{status}</div>}
      </div>

      <footer className="card__foot">
        <span title={path.length ? path.join(' / ') : 'Unsorted'}>
          <Icon name="folder" size={14} /> {path.length ? path[path.length - 1] : 'Unsorted'}
        </span>
        <span className="note-card__stats">
          {listed.length > 0 && (
            <span title={`${listed.length} attachment${listed.length === 1 ? '' : 's'}`}>
              <Icon name="paperclip" size={13} /> {listed.length}
            </span>
          )}
          <time dateTime={note.updatedAt} title={`Updated ${new Date(note.updatedAt).toLocaleString()}`}>
            <Icon name="clock" size={14} /> {timeAgo(note.updatedAt)}
          </time>
        </span>
      </footer>

      {over && (
        <div className="card__drop" aria-hidden="true">
          <Icon name="paperclip" size={18} /> Drop to attach to “{note.title}”
        </div>
      )}
    </motion.article>
  )
})
