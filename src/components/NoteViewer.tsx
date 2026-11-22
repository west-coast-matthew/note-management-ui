import { useEffect } from 'react'
import { motion } from 'motion/react'
import type { Note } from '../types'
import { NoteBody } from './RichTextEditor'
import { AttachmentTile } from './attachments'
import { Button } from './form'
import { Eyebrow, Icon, timeAgo } from './ui'

interface Props {
  note: Note
  path: string[]
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
  deleting?: boolean
}

/** Reading view for a note: formatted body and its attachments. */
export function NoteViewer({ note, path, onEdit, onDelete, onClose, deleting }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      // "e" to edit, unless the user is typing somewhere.
      if (e.key === 'e' && !e.metaKey && !e.ctrlKey && !(e.target as HTMLElement).closest('input, textarea, [contenteditable="true"]')) onEdit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onEdit])

  const listed = note.attachments.filter((a) => !a.embedded)
  const updated = note.updatedAt !== note.createdAt

  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.article
        className="modal modal--editor viewer"
        role="dialog"
        aria-modal
        aria-labelledby="note-view-title"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      >
        <header className="modal__head">
          <div>
            <Eyebrow>{path.length ? path.join(' / ') : 'Unsorted'}</Eyebrow>
            <h2 id="note-view-title">{note.title}</h2>
            <p className="viewer__meta mono">
              <span title={new Date(note.createdAt).toLocaleString()}>
                <Icon name="clock" size={13} /> Created {timeAgo(note.createdAt)}
              </span>
              {updated && <span title={new Date(note.updatedAt).toLocaleString()}>Updated {timeAgo(note.updatedAt)}</span>}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>

        {note.summary && <p className="viewer__summary">{note.summary}</p>}

        <div className="viewer__body">{note.body ? <NoteBody html={note.body} /> : <p className="viewer__empty">No body text.</p>}</div>

        {listed.length > 0 && (
          <section className="attachments" aria-labelledby="viewer-attachments-title">
            <span id="viewer-attachments-title" className="field__label mono">
              Attachments <em>{listed.length}</em>
            </span>
            <ul className="att-grid">
              {listed.map((a) => (
                <AttachmentTile key={a.id} attachment={a} />
              ))}
            </ul>
          </section>
        )}

        <footer className="modal__foot">
          <Button onClick={onDelete} loading={deleting} icon={<Icon name="trash" size={14} />}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
          <Button variant="primary" onClick={onEdit} icon={<Icon name="edit" size={14} />}>
            Edit
          </Button>
        </footer>
      </motion.article>
    </motion.div>
  )
}
