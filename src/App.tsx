import { useCallback, useMemo, useRef, useState, type DragEvent, type Ref } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { categoryPath, subtreeIds } from './lib/categories'
import { hasFiles } from './lib/files'
import { plainText } from './lib/html'
import type { Category, Note } from './types'
import { describeError } from './services/contract'
import {
  useAttachToNote,
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useDeleteNote,
  useNotes,
  useSaveNote,
  useUpdateCategory,
} from './services/notes-queries'
import { Sidebar, type Selection } from './components/Sidebar'
import { NoteCard } from './components/NoteCard'
import { NoteRow } from './components/NoteRow'
import { NoteEditor, type NoteSave } from './components/NoteEditor'
import { NoteViewer } from './components/NoteViewer'
import { useViewPreferences, type ViewMode } from './stores/view-preferences'
import { StatusText } from './components/StatusText'
import { Eyebrow, Icon, Toggle } from './components/ui'

type Sort = 'updated' | 'created'
/** `categoryId` preselects a category; `files` starts a new note with attachments dropped on the page. */
type Editor = { mode: 'add'; categoryId?: string | null; files?: File[] } | { mode: 'edit'; noteId: string } | null

/** A card or list row wired to its own delete/attach requests, so each one shows its own status. */
function ConnectedNote({
  note,
  path,
  view,
  onOpen,
  onEdit,
  ref,
}: {
  note: Note
  path: string[]
  view: ViewMode
  onOpen: () => void
  onEdit: () => void
  ref?: Ref<HTMLElement>
}) {
  const remove = useDeleteNote()
  const attach = useAttachToNote()

  const status = attach.isPending ? (
    <StatusText>Attaching {attach.variables.files.length === 1 ? attach.variables.files[0].name : `${attach.variables.files.length} files`}…</StatusText>
  ) : remove.isPending ? (
    <StatusText>Deleting…</StatusText>
  ) : attach.isError ? (
    <StatusText tone="error" onDismiss={attach.reset}>
      Couldn't attach the files. {describeError(attach.error)}
    </StatusText>
  ) : remove.isError ? (
    <StatusText tone="error" onDismiss={remove.reset}>
      Couldn't delete this note. {describeError(remove.error)}
    </StatusText>
  ) : null

  const Item = view === 'list' ? NoteRow : NoteCard
  return (
    <Item
      ref={ref}
      note={note}
      path={path}
      status={status}
      onOpen={onOpen}
      onEdit={onEdit}
      onDelete={() => !remove.isPending && confirm(`Delete "${note.title}" and its attachments?`) && remove.mutate(note.id)}
      onDropFiles={(files) => !attach.isPending && attach.mutate({ noteId: note.id, files })}
    />
  )
}

export default function App() {
  const categoriesQuery = useCategories()
  const notesQuery = useNotes()
  const categories = useMemo<Category[]>(() => categoriesQuery.data ?? [], [categoriesQuery.data])
  const notes = useMemo<Note[]>(() => notesQuery.data ?? [], [notesQuery.data])

  const saveNote = useSaveNote()
  const deleteNote = useDeleteNote()
  const createCategory = useCreateCategory()
  const renameCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()

  const [selection, setSelection] = useState<Selection>({ kind: 'all' })
  const [sort, setSort] = useState<Sort>('updated')
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<Editor>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const viewMode = useViewPreferences((s) => s.viewMode)
  const setViewMode = useViewPreferences((s) => s.setViewMode)

  const selectedCategoryId = selection.kind === 'category' ? selection.id : null
  const selectedCategory = selection.kind === 'category' ? categories.find((c) => c.id === selection.id) : undefined

  const openEditor = (next: Exclude<Editor, null>) => {
    saveNote.reset()
    setViewingId(null)
    setEditor(next)
  }
  const closeEditor = useCallback(() => setEditor(null), [])
  const editingNote = editor?.mode === 'edit' ? notes.find((n) => n.id === editor.noteId) : undefined
  const viewing = viewingId ? notes.find((n) => n.id === viewingId) : undefined

  const save = ({ draft, removeAttachmentIds }: NoteSave) => {
    const id = editor?.mode === 'edit' ? editor.noteId : undefined
    saveNote.mutate(
      { id, draft, removeAttachmentIds },
      {
        onSuccess: (note) => {
          closeEditor()
          setViewingId(note.id)
        },
      },
    )
  }

  /* ----- Filtering and search ----- */
  const visible = useMemo(() => {
    let list = notes
    if (selection.kind === 'unsorted') list = list.filter((n) => !n.categoryId)
    if (selection.kind === 'category') {
      const ids = subtreeIds(categories, selection.id)
      list = list.filter((n) => n.categoryId && ids.has(n.categoryId))
    }
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (terms.length) {
      list = list.filter((n) => {
        const haystack = [n.title, n.summary ?? '', plainText(n.body), ...n.attachments.map((a) => a.fileName)].join(' ').toLowerCase()
        return terms.every((t) => haystack.includes(t))
      })
    }
    const key = sort === 'updated' ? 'updatedAt' : 'createdAt'
    return [...list].sort((a, b) => b[key].localeCompare(a[key]))
  }, [notes, categories, selection, query, sort])

  const heading = selection.kind === 'all' ? 'All notes' : selection.kind === 'unsorted' ? 'Unsorted' : (selectedCategory?.name ?? '')
  const parentPath = selectedCategory ? categoryPath(categories, selectedCategory.parentId) : []
  const fileCount = visible.reduce((n, note) => n + note.attachments.filter((a) => !a.embedded).length, 0)

  /* ----- Drop files on the page to start a note with them ----- */
  const [pageDrop, setPageDrop] = useState(false)
  const dropDepth = useRef(0)
  const blocked = !!editor || !!viewing
  const pageDropHandlers = {
    onDragEnter: (e: DragEvent) => {
      if (!hasFiles(e) || blocked) return
      dropDepth.current++
      setPageDrop(true)
    },
    onDragOver: (e: DragEvent) => hasFiles(e) && !blocked && e.preventDefault(),
    onDragLeave: () => {
      dropDepth.current = Math.max(0, dropDepth.current - 1)
      if (!dropDepth.current) setPageDrop(false)
    },
    onDrop: (e: DragEvent) => {
      dropDepth.current = 0
      setPageDrop(false)
      // Cards handle drops onto themselves (and stop them); anything else starts a new note.
      if (!hasFiles(e) || blocked) return
      e.preventDefault()
      openEditor({ mode: 'add', categoryId: selectedCategoryId, files: [...e.dataTransfer.files] })
    },
  }

  /* ----- Sidebar status: loading, then whichever category request is active or failed ----- */
  const categoryMutations = [
    { m: createCategory, pending: `Adding “${createCategory.variables?.name ?? ''}”…`, failed: "Couldn't add the category." },
    { m: renameCategory, pending: 'Renaming…', failed: "Couldn't rename the category." },
    { m: deleteCategory, pending: 'Deleting category…', failed: "Couldn't delete the category." },
  ]
  const activeCategoryMutation = categoryMutations.find(({ m }) => m.isPending) ?? categoryMutations.find(({ m }) => m.isError)
  const sidebarStatus = categoriesQuery.isPending ? (
    <StatusText>Loading categories…</StatusText>
  ) : categoriesQuery.isError ? (
    <StatusText tone="error" onRetry={() => categoriesQuery.refetch()}>
      Couldn't load categories. {describeError(categoriesQuery.error)}
    </StatusText>
  ) : activeCategoryMutation?.m.isPending ? (
    <StatusText>{activeCategoryMutation.pending}</StatusText>
  ) : activeCategoryMutation ? (
    <StatusText tone="error" onDismiss={activeCategoryMutation.m.reset}>
      {activeCategoryMutation.failed} {describeError(activeCategoryMutation.m.error)}
    </StatusText>
  ) : null

  return (
    <div className="app" {...pageDropHandlers}>
      <Sidebar
        categories={categories}
        notes={notes}
        selection={selection}
        onSelect={setSelection}
        onCreate={(name, parentId) => createCategory.mutate({ name, parentId })}
        onRename={(id, name) => renameCategory.mutate({ id, input: { name } })}
        onDelete={(id) => {
          if (selection.kind === 'category' && subtreeIds(categories, id).has(selection.id)) setSelection({ kind: 'all' })
          deleteCategory.mutate(id)
        }}
        onAddNote={(categoryId) => openEditor({ mode: 'add', categoryId })}
        status={sidebarStatus}
      />

      <main className="main">
        <section className="hero">
          <div>
            <Eyebrow>{parentPath.length ? parentPath.join(' / ') : selection.kind === 'category' ? 'Category' : 'Library'}</Eyebrow>
            <AnimatePresence mode="wait">
              <motion.h1
                key={heading}
                initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
                transition={{ duration: 0.28 }}
              >
                {heading}
              </motion.h1>
            </AnimatePresence>
            {notesQuery.isSuccess && (
              <p className="hero__meta">
                <span className="hero__count">{visible.length}</span> note{visible.length === 1 ? '' : 's'}
                {fileCount > 0 && (
                  <>
                    {' '}
                    · {fileCount} attachment{fileCount === 1 ? '' : 's'}
                  </>
                )}
              </p>
            )}
          </div>
          <div className="hero__actions">
            <button type="button" className="btn btn--primary btn--lg mono" onClick={() => openEditor({ mode: 'add', categoryId: selectedCategoryId })}>
              <Icon name="plus" size={16} /> New note
            </button>
          </div>
        </section>

        <div className="toolbar">
          <Toggle left={{ value: 'updated', label: 'Updated' }} right={{ value: 'created', label: 'Created' }} value={sort} onChange={setSort} />
          <div className="view-switch" role="radiogroup" aria-label="Layout">
            {(
              [
                ['cards', 'grid', 'Cards'],
                ['list', 'list', 'List'],
              ] as const
            ).map(([mode, icon, label]) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={viewMode === mode}
                title={`Show as ${label.toLowerCase()}`}
                className={`view-switch__btn ${viewMode === mode ? 'is-active' : ''}`}
                onClick={() => setViewMode(mode)}
              >
                {viewMode === mode && <motion.span layoutId="view-switch" className="view-switch__thumb" />}
                <Icon name={icon} size={15} />
                <span className="sr-only">{label}</span>
              </button>
            ))}
          </div>
          <label className="search">
            <Icon name="search" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes and files…" aria-label="Search notes" />
          </label>
        </div>

        <div className="status-bar">
          {notesQuery.isPending && <StatusText>Loading notes…</StatusText>}
          {notesQuery.isError && (
            <StatusText tone="error" onRetry={() => notesQuery.refetch()}>
              Couldn't load notes. {describeError(notesQuery.error)}
            </StatusText>
          )}
          {notesQuery.isRefetching && <StatusText>Refreshing notes…</StatusText>}
        </div>

        <motion.div layout className={viewMode === 'list' ? 'list' : 'grid'}>
          <AnimatePresence mode="popLayout">
            {visible.map((note) => (
              <ConnectedNote
                key={note.id}
                view={viewMode}
                note={note}
                path={categoryPath(categories, note.categoryId)}
                onOpen={() => setViewingId(note.id)}
                onEdit={() => openEditor({ mode: 'edit', noteId: note.id })}
              />
            ))}
          </AnimatePresence>
        </motion.div>

        <AnimatePresence>
          {notesQuery.isSuccess && visible.length === 0 && (
            <motion.div className="empty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Eyebrow>Empty</Eyebrow>
              <p>{query ? 'No notes match your search.' : 'Nothing saved here yet. Drop files anywhere to start a note with them.'}</p>
              {!query && (
                <button type="button" className="btn btn--ghost mono" onClick={() => openEditor({ mode: 'add', categoryId: selectedCategoryId })}>
                  Write the first note <Icon name="arrow" size={14} />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {pageDrop && (
          <motion.div className="page-drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden="true">
            <div className="page-drop__inner">
              <Icon name="upload" size={26} />
              <strong>Drop to start a new note</strong>
              <span>Drop onto an existing note to attach the files to it instead.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewing && !editor && (
          <NoteViewer
            key="viewer"
            note={viewing}
            path={categoryPath(categories, viewing.categoryId)}
            onClose={() => setViewingId(null)}
            onEdit={() => openEditor({ mode: 'edit', noteId: viewing.id })}
            deleting={deleteNote.isPending}
            onDelete={() =>
              confirm(`Delete "${viewing.title}" and its attachments?`) &&
              deleteNote.mutate(viewing.id, { onSuccess: () => setViewingId(null) })
            }
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editor && (editor.mode === 'add' || editingNote) && (
          <NoteEditor
            key={editor.mode === 'edit' ? editor.noteId : 'new'}
            categories={categories}
            initial={editingNote}
            initialFiles={editor.mode === 'add' ? editor.files : undefined}
            defaultCategoryId={editor.mode === 'add' ? (editor.categoryId ?? null) : null}
            onClose={closeEditor}
            onSave={save}
            saving={saveNote.isPending}
            serverError={saveNote.isError ? describeError(saveNote.error) : undefined}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
