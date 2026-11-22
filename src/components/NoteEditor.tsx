import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Attachment, Category, Note, NoteDraft } from '../types'
import { hasFiles } from '../lib/files'
import { categoryOptions } from '../lib/categories'
import { isEmptyBody, referencedAssetIds } from '../lib/html'
import { useUploads } from '../lib/use-uploads'
import { RichTextEditor, type RichTextEditorHandle } from './RichTextEditor'
import { AttachmentTile, Dropzone, PendingTile } from './attachments'
import { Eyebrow, Icon } from './ui'
import { Button, Field, SelectField, TextArea, TextField } from './form'

export interface NoteSave {
  draft: NoteDraft
  /** Attachments the user removed; deleted once the note saves. */
  removeAttachmentIds: string[]
}

interface Props {
  categories: Category[]
  /** Existing note when editing; undefined when creating. */
  initial?: Note
  defaultCategoryId: string | null
  /** Files to start with, e.g. dropped onto the page to make a new note from them. */
  initialFiles?: File[]
  onSave: (save: NoteSave) => void
  onClose: () => void
  /** Render in place (artboard) instead of as a modal dialog. */
  inline?: boolean
  saving?: boolean
  serverError?: string
  /** Called with the current values on every change (the artboard previews the request body). */
  onDraftChange?: (draft: NoteDraft) => void
}

export function NoteEditor({ categories, initial, defaultCategoryId, initialFiles, onSave, onClose, inline, saving, serverError, onDraftChange }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [summary, setSummary] = useState(initial?.summary ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(initial ? initial.categoryId : defaultCategoryId)
  const [body, setBody] = useState(initial?.body ?? '')
  /** Listed (non-embedded) attachments: the note's own, then new uploads. */
  const [attachments, setAttachments] = useState<Attachment[]>(() => initial?.attachments.filter((a) => !a.embedded) ?? [])
  const [removed, setRemoved] = useState<string[]>([])
  const [errors, setErrors] = useState<{ title?: string }>({})
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  const editorRef = useRef<RichTextEditorHandle>(null)

  const files = useUploads()
  const images = useUploads()
  const uploading = files.busy || images.busy

  const initialIds = useMemo(() => new Set(initial?.attachments.map((a) => a.id)), [initial])
  const draft = useMemo<NoteDraft>(
    () => ({
      title: title.trim(),
      summary: summary.trim() || null,
      body,
      categoryId,
      // Only new uploads need claiming; the note's own attachments are already filed under it.
      attachmentIds: attachments.filter((a) => !initialIds.has(a.id)).map((a) => a.id),
    }),
    [title, summary, body, categoryId, attachments, initialIds],
  )
  const dirty = initial
    ? draft.title !== initial.title ||
      draft.summary !== initial.summary ||
      body !== initial.body ||
      draft.categoryId !== initial.categoryId ||
      draft.attachmentIds.length > 0 ||
      removed.length > 0
    : !!(draft.title || draft.summary || !isEmptyBody(body) || attachments.length)

  useEffect(() => {
    onDraftChange?.(draft)
  }, [draft, onDraftChange])

  const attach = useCallback(
    async (list: File[]) => {
      const stored = await files.upload(list)
      setAttachments((prev) => [...prev, ...stored])
    },
    [files],
  )

  // Files dropped on the page to start this note.
  const started = useRef(false)
  useEffect(() => {
    if (started.current || !initialFiles?.length) return
    started.current = true
    void attach(initialFiles)
  }, [initialFiles, attach])

  const uploadImages = useCallback((list: File[]) => images.upload(list, { embedded: true }), [images])

  const close = useCallback(() => {
    if (saving) return
    if (dirty && !inline && !confirm('Discard your changes to this note?')) return
    onClose()
  }, [saving, dirty, inline, onClose])

  useEffect(() => {
    if (inline) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inline, close])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (saving || uploading) return
    const next = { title: title.trim() ? undefined : 'Add a title so you can find this note later' }
    setErrors(next)
    if (next.title) return
    onSave({ draft, removeAttachmentIds: removed })
  }

  const remove = (a: Attachment) => {
    setAttachments((prev) => prev.filter((x) => x.id !== a.id))
    // New uploads are simply dropped (the server sweeps unclaimed ones); the note's own are deleted on save.
    if (initialIds.has(a.id)) setRemoved((prev) => [...prev, a.id])
  }

  /* ----- Drop anywhere on the form (outside the body) to attach ----- */
  const onDragEnter = (e: DragEvent) => {
    if (!hasFiles(e) || saving) return
    dragDepth.current++
    setDragging(true)
  }
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (!dragDepth.current) setDragging(false)
  }
  const onDrop = (e: DragEvent) => {
    dragDepth.current = 0
    setDragging(false)
    // The body editor and the drop zone handle their own drops.
    if (!hasFiles(e) || e.defaultPrevented || saving) return
    e.preventDefault()
    void attach([...e.dataTransfer.files])
  }

  const bodyRefs = useMemo(() => referencedAssetIds(body), [body])
  const embeddedCount = initial?.attachments.filter((a) => a.embedded && bodyRefs.has(a.id)).length ?? 0

  const form = (
    <motion.form
      className={`modal modal--editor ${inline ? 'modal--inline' : ''}`}
      onSubmit={submit}
      role={inline ? undefined : 'dialog'}
      aria-modal={inline ? undefined : true}
      aria-labelledby="note-form-title"
      aria-busy={saving || undefined}
      initial={inline ? false : { opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      noValidate
      onDragEnter={onDragEnter}
      onDragOver={(e) => hasFiles(e) && e.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <header className="modal__head">
        <div>
          <Eyebrow>{initial ? 'Edit' : 'New'}</Eyebrow>
          <h2 id="note-form-title">{initial ? 'Edit note' : 'New note'}</h2>
        </div>
        {!inline && (
          <button type="button" className="icon-btn" onClick={close} aria-label="Close">
            <Icon name="close" />
          </button>
        )}
      </header>

      <AnimatePresence>
        {serverError && (
          <motion.div className="banner banner--error" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <div className="banner__inner">{serverError}</div>
          </motion.div>
        )}
      </AnimatePresence>

      <fieldset className="modal__fields" disabled={saving}>
        <div className="field-row field-row--editor">
          <TextField label="Title" autoFocus={!inline && !initial} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is this about?" error={errors.title} />
          <SelectField
            label="Category"
            value={categoryId ?? ''}
            onChange={(e) => setCategoryId(e.target.value || null)}
            options={[{ value: '', label: 'Unsorted' }, ...categoryOptions(categories)]}
          />
        </div>
        <TextArea label="Summary" optional rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="One or two lines shown on the card…" />

        <Field
          label="Body"
          hint={
            <>
              Paste or drop images straight into the text. Select an image to set it on its own line or inline with the text.
              {embeddedCount > 0 && ` ${embeddedCount} image${embeddedCount === 1 ? '' : 's'} stored with this note.`}
            </>
          }
        >
          {() => (
            <RichTextEditor
              ref={editorRef}
              initialHtml={initial?.body ?? ''}
              onChange={setBody}
              onUploadImages={uploadImages}
              onAttachFiles={(list) => void attach(list)}
              uploading={images.busy}
              disabled={saving}
            />
          )}
        </Field>
        {images.pending.some((p) => p.error) && (
          <ul className="att-grid">
            {images.pending
              .filter((p) => p.error)
              .map((p) => (
                <PendingTile key={p.key} upload={p} onDismiss={() => images.dismiss(p.key)} />
              ))}
          </ul>
        )}

        <section className="attachments" aria-labelledby="note-attachments-title">
          <div className="attachments__head">
            <span id="note-attachments-title" className="field__label mono">
              Attachments {attachments.length > 0 && <em>{attachments.length}</em>}
            </span>
          </div>
          <Dropzone onFiles={(list) => void attach(list)} disabled={saving} compact={attachments.length + files.pending.length > 0} title="Drop files to attach" />
          {(attachments.length > 0 || files.pending.length > 0) && (
            <ul className="att-grid">
              <AnimatePresence initial={false}>
                {attachments.map((a) => (
                  <AttachmentTile
                    key={a.id}
                    attachment={a}
                    onRemove={saving ? undefined : () => remove(a)}
                    onInsert={a.kind === 'image' && !saving ? () => editorRef.current?.insertImages([a]) : undefined}
                  />
                ))}
                {files.pending.map((p) => (
                  <PendingTile key={p.key} upload={p} onDismiss={() => files.dismiss(p.key)} />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>
      </fieldset>

      <footer className="modal__foot">
        {uploading && <span className="modal__foot-note">Waiting for uploads to finish…</span>}
        <Button onClick={close} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving} disabled={uploading} icon={<Icon name="check" size={14} />}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Save note'}
        </Button>
      </footer>

      <AnimatePresence>
        {dragging && (
          <motion.div className="drop-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden="true">
            <Icon name="paperclip" size={22} />
            <span>Drop on the text to place images in the body, anywhere else to attach.</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.form>
  )

  if (inline) return form

  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      {form}
    </motion.div>
  )
}
