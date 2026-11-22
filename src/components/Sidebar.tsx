import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Category, Note } from '../types'
import { subtreeIds } from '../lib/categories'
import { Eyebrow, Icon } from './ui'

export type Selection = { kind: 'all' } | { kind: 'unsorted' } | { kind: 'category'; id: string }

interface Props {
  categories: Category[]
  notes: Note[]
  selection: Selection
  onSelect: (s: Selection) => void
  onCreate: (name: string, parentId: string | null) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  /** Open the New note editor with this category preselected. */
  onAddNote: (categoryId: string) => void
  /** Loading / saving / error text for category data, shown above the "New category" button. */
  status?: ReactNode
}

/** Inline text field used for creating and renaming categories. */
function InlineInput({
  initial = '',
  placeholder,
  onSubmit,
  onCancel,
}: {
  initial?: string
  placeholder: string
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial)
  // Enter and blur both submit; make sure only the first one counts.
  const done = useRef(false)
  const finish = (fn: () => void) => {
    if (done.current) return
    done.current = true
    fn()
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    finish(() => (trimmed ? onSubmit(trimmed) : onCancel()))
  }
  return (
    <motion.form
      className="inline-input"
      onSubmit={submit}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
    >
      <input
        autoFocus
        value={name}
        placeholder={placeholder}
        onChange={(e) => setName(e.target.value)}
        onBlur={submit}
        onKeyDown={(e) => e.key === 'Escape' && finish(onCancel)}
      />
    </motion.form>
  )
}

export function Sidebar({
  categories,
  notes,
  selection,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onAddNote,
  status,
}: Props) {
  // Track collapsed rather than expanded nodes so categories that arrive later start open.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [adding, setAdding] = useState<string | 'root' | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)

  const countFor = (id: string) => {
    const ids = subtreeIds(categories, id)
    return notes.filter((n) => n.categoryId && ids.has(n.categoryId)).length
  }
  const unsortedCount = notes.filter((n) => !n.categoryId).length

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const remove = (c: Category) => {
    const subs = subtreeIds(categories, c.id).size - 1
    const msg =
      `Delete "${c.name}"` +
      (subs ? ` and ${subs} subcategor${subs === 1 ? 'y' : 'ies'}` : '') +
      `? Its notes will move ${c.parentId ? 'to the parent category' : 'to Unsorted'}.`
    if (!confirm(msg)) return
    if (selection.kind === 'category' && subtreeIds(categories, c.id).has(selection.id)) onSelect({ kind: 'all' })
    onDelete(c.id)
  }

  const renderNode = (c: Category, depth: number) => {
    const children = categories.filter((x) => x.parentId === c.id)
    const isOpen = !collapsed.has(c.id)
    const active = selection.kind === 'category' && selection.id === c.id
    return (
      <motion.li key={c.id} layout="position" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
        {renaming === c.id ? (
          <InlineInput
            initial={c.name}
            placeholder="Category name"
            onSubmit={(name) => {
              onRename(c.id, name)
              setRenaming(null)
            }}
            onCancel={() => setRenaming(null)}
          />
        ) : (
          <div className={`nav-item ${active ? 'is-active' : ''}`} style={{ paddingLeft: 10 + depth * 16 }}>
            <button
              type="button"
              className="nav-item__chevron"
              onClick={() => toggle(c.id)}
              aria-label={isOpen ? 'Collapse' : 'Expand'}
              style={{ visibility: children.length ? 'visible' : 'hidden' }}
            >
              <motion.span animate={{ rotate: isOpen ? 90 : 0 }} style={{ display: 'inline-flex' }}>
                <Icon name="chevron" size={14} />
              </motion.span>
            </button>
            <button type="button" className="nav-item__name" onClick={() => onSelect({ kind: 'category', id: c.id })}>
              {c.name}
            </button>
            <span className="nav-item__count mono">{countFor(c.id)}</span>
            <span className="nav-item__actions">
              <button type="button" title={`New note in ${c.name}`} aria-label={`New note in ${c.name}`} onClick={() => onAddNote(c.id)}>
                <Icon name="note" size={14} />
              </button>
              <button
                type="button"
                title="Add subcategory"
                onClick={() => {
                  setAdding(c.id)
                  setCollapsed((p) => {
                    const next = new Set(p)
                    next.delete(c.id)
                    return next
                  })
                }}
              >
                <Icon name="plus" size={14} />
              </button>
              <button type="button" title="Rename" onClick={() => setRenaming(c.id)}>
                <Icon name="edit" size={14} />
              </button>
              <button type="button" title="Delete" onClick={() => remove(c)}>
                <Icon name="trash" size={14} />
              </button>
            </span>
            {active && <motion.span layoutId="nav-active" className="nav-item__indicator" />}
          </div>
        )}
        <AnimatePresence initial={false}>
          {isOpen && (children.length > 0 || adding === c.id) && (
            <motion.ul
              className="nav-tree"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <AnimatePresence initial={false}>{children.map((child) => renderNode(child, depth + 1))}</AnimatePresence>
              <AnimatePresence>
                {adding === c.id && (
                  <li style={{ paddingLeft: 10 + (depth + 1) * 16 }}>
                    <InlineInput
                      placeholder="Subcategory name"
                      onSubmit={(name) => {
                        onCreate(name, c.id)
                        setAdding(null)
                      }}
                      onCancel={() => setAdding(null)}
                    />
                  </li>
                )}
              </AnimatePresence>
            </motion.ul>
          )}
        </AnimatePresence>
      </motion.li>
    )
  }

  const fixedItem = (sel: Selection, label: string, count: number) => {
    const active = selection.kind === sel.kind
    return (
      <div className={`nav-item nav-item--fixed ${active ? 'is-active' : ''}`}>
        <button type="button" className="nav-item__name" onClick={() => onSelect(sel)}>
          {label}
        </button>
        <span className="nav-item__count mono">{count}</span>
        {active && <motion.span layoutId="nav-active" className="nav-item__indicator" />}
      </div>
    )
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand__mark" />
        <span className="brand__name">Notes</span>
      </div>

      <nav>
        {fixedItem({ kind: 'all' }, 'All notes', notes.length)}
        {fixedItem({ kind: 'unsorted' }, 'Unsorted', unsortedCount)}

        <div className="sidebar__section">
          <Eyebrow>Categories</Eyebrow>
        </div>
        <ul className="nav-tree">
          <AnimatePresence initial={false}>
            {categories.filter((c) => c.parentId === null).map((c) => renderNode(c, 0))}
          </AnimatePresence>
        </ul>
        <AnimatePresence>
          {adding === 'root' && (
            <InlineInput
              placeholder="Category name"
              onSubmit={(name) => {
                onCreate(name, null)
                setAdding(null)
              }}
              onCancel={() => setAdding(null)}
            />
          )}
        </AnimatePresence>
      </nav>

      {status}

      <button type="button" className="btn btn--dashed mono" onClick={() => setAdding('root')}>
        <Icon name="plus" size={14} /> New category
      </button>
    </aside>
  )
}
