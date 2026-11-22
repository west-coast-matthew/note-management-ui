import { forwardRef } from 'react'
import { motion } from 'motion/react'
import { plainText } from '../lib/html'
import { useFileDrop, type NoteItemProps } from './NoteCard'
import { Icon, timeAgo } from './ui'

/** A note as one compact row, for list mode. Same data and actions as NoteCard. */
export const NoteRow = forwardRef<HTMLElement, NoteItemProps>(function NoteRow({ note, path, onOpen, onEdit, onDelete, onDropFiles, status }, ref) {
  const { over, handlers } = useFileDrop(onDropFiles)
  const files = note.attachments.filter((a) => !a.embedded).length
  const excerpt = note.summary || plainText(note.body)
  return (
    <motion.article
      ref={ref}
      layout
      className={`row ${over ? 'is-drop-target' : ''}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      {...handlers}
    >
      <div className="row__main">
        <button type="button" className="row__title" onClick={onOpen} title={note.title}>
          {note.title}
        </button>
        {excerpt && (
          <span className="row__meta">
            <span className="row__desc">{excerpt}</span>
          </span>
        )}
      </div>

      {/* Always rendered, even when empty, so the columns line up from row to row. */}
      <span className="row__path" title={path.length ? path.join(' / ') : undefined}>
        {path.length > 0 && (
          <>
            <Icon name="folder" size={13} />
            {path.join(' / ')}
          </>
        )}
      </span>

      <span className="row__files mono" title={files ? `${files} attachment${files === 1 ? '' : 's'}` : undefined}>
        {files > 0 && (
          <>
            <Icon name="paperclip" size={13} /> {files}
          </>
        )}
      </span>

      <time className="row__time" dateTime={note.updatedAt} title={`Updated ${new Date(note.updatedAt).toLocaleString()}`}>
        {timeAgo(note.updatedAt)}
      </time>

      <span className="row__tools">
        <button type="button" title="Edit note" aria-label={`Edit ${note.title}`} onClick={onEdit}>
          <Icon name="edit" size={15} />
        </button>
        <button type="button" title="Delete note" aria-label={`Delete ${note.title}`} onClick={onDelete}>
          <Icon name="trash" size={15} />
        </button>
      </span>

      {status && <div className="row__status">{status}</div>}
    </motion.article>
  )
})
