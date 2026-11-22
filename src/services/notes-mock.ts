/**
 * Note management service — an emulation of the REST backend.
 *
 * Every method corresponds to one call definition in ./mock-data, which is the API
 * contract. The emulation:
 *   - seeds its data from the 200 responses in mock-data/{categories,notes}/list.json
 *   - waits a random delay per call so loading states are visible
 *   - can fail at random with the transient errors in mock-data/errors.json
 *   - applies the validation and business rules written in each call definition
 *   - persists categories and notes to localStorage so they survive a reload
 *
 * Uploaded files are kept as in-memory object URLs: they work until the page reloads,
 * after which their attachments are dropped. It's used when VITE_API_BASE_URL is not set
 * (see notes-client.ts); the real API lives in notes-http.ts.
 */
import type {
  Attachment,
  Category,
  CreateCategoryInput,
  CreateNoteInput,
  DataResponse,
  DeleteCategoryResult,
  ErrorCode,
  FieldError,
  ListResponse,
  Note,
  UpdateCategoryInput,
  UpdateNoteInput,
  UploadInput,
} from '../types'
import { ApiError, ERRORS, type NoteManagementApi, type ProgressListener } from './contract'
import { isEmptyBody, referencedAssetIds } from '../lib/html'
import { kindOf } from '../lib/files'

import models from '../../mock-data/models.json'
import listCategoriesDef from '../../mock-data/categories/list.json'
import getCategoryDef from '../../mock-data/categories/get.json'
import createCategoryDef from '../../mock-data/categories/create.json'
import updateCategoryDef from '../../mock-data/categories/update.json'
import deleteCategoryDef from '../../mock-data/categories/delete.json'
import listNotesDef from '../../mock-data/notes/list.json'
import getNoteDef from '../../mock-data/notes/get.json'
import createNoteDef from '../../mock-data/notes/create.json'
import updateNoteDef from '../../mock-data/notes/update.json'
import deleteNoteDef from '../../mock-data/notes/delete.json'
import uploadDef from '../../mock-data/attachments/upload.json'
import deleteAttachmentDef from '../../mock-data/attachments/delete.json'

/* ---------- Contract plumbing ---------- */

interface CallDefinition {
  name: string
  method: string
  path: string
  errors: string[]
}

const NOTE_FIELDS = models.Note.fields
const CATEGORY_FIELDS = models.Category.fields

/* ---------- Options ---------- */

export interface MockOptions {
  minDelayMs: number
  maxDelayMs: number
  /** 0–1: chance that any call fails with INTERNAL_ERROR or SERVICE_UNAVAILABLE. */
  errorRate: number
  /** Log each emulated request to the console. */
  log: boolean
}

const envNumber = (value: string | undefined, fallback: number) => {
  const n = Number(value)
  return value !== undefined && value !== '' && Number.isFinite(n) ? n : fallback
}

const DEFAULT_OPTIONS: MockOptions = {
  minDelayMs: envNumber(import.meta.env.VITE_MOCK_MIN_DELAY_MS, 600),
  maxDelayMs: envNumber(import.meta.env.VITE_MOCK_MAX_DELAY_MS, 1500),
  errorRate: envNumber(import.meta.env.VITE_MOCK_ERROR_RATE, 0),
  log: import.meta.env.DEV,
}

/* ---------- Mock database ---------- */

/** Notes are stored without attachments; those are joined in from `attachments` on the way out. */
type StoredNote = Omit<Note, 'attachments'>

interface Db {
  categories: Category[]
  notes: StoredNote[]
}

const DB_KEY = 'note-management:mock-db:v1'

function seedDb(): Db {
  return structuredClone({
    categories: listCategoriesDef.responses[0].body.data as Category[],
    notes: (listNotesDef.responses[0].body.data as Note[]).map(({ attachments: _, ...n }) => n),
  })
}

function loadDb(): Db {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) return JSON.parse(raw) as Db
  } catch {
    /* unreadable or unavailable — start from the seed */
  }
  return seedDb()
}

const sameText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0

/** The id plus every descendant id of a category. */
function subtree(categories: Category[], rootId: string): Set<string> {
  const ids = new Set([rootId])
  for (let grew = true; grew; ) {
    grew = false
    for (const c of categories) {
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id)
        grew = true
      }
    }
  }
  return ids
}

const imageSize = async (file: File) => {
  try {
    const bitmap = await createImageBitmap(file)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return size
  } catch {
    return null
  }
}

/* ---------- Service ---------- */

export class NoteManagementService implements NoteManagementApi {
  private options: MockOptions
  private db: Db
  /** In memory only: object URLs don't survive a reload. */
  private attachments: Attachment[] = []

  constructor(options: Partial<MockOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.db = loadDb()
  }

  /** Adjust delay or error rate at runtime, e.g. `mockApi.configure({ errorRate: 1 })` in the console. */
  configure(options: Partial<MockOptions>) {
    this.options = { ...this.options, ...options }
    return { ...this.options }
  }

  /** Throw away all changes and go back to the seed data in mock-data. */
  reset() {
    this.db = seedDb()
    this.attachments = []
    this.persist()
  }

  /* ----- Categories ----- */

  listCategories(): Promise<ListResponse<Category>> {
    return this.request(listCategoriesDef, {}, () => ({ data: this.db.categories, meta: { total: this.db.categories.length } }))
  }

  getCategory(id: string): Promise<DataResponse<Category>> {
    return this.request(getCategoryDef, { id }, () => ({ data: this.findCategory(id) }))
  }

  createCategory(input: CreateCategoryInput): Promise<DataResponse<Category>> {
    return this.request(createCategoryDef, {}, () => {
      const name = this.validateCategory(input, null, true)
      const now = new Date().toISOString()
      const category: Category = { id: crypto.randomUUID(), name: name!, parentId: input.parentId ?? null, createdAt: now, updatedAt: now }
      this.db.categories.push(category)
      return { data: category }
    })
  }

  updateCategory(id: string, input: UpdateCategoryInput): Promise<DataResponse<Category>> {
    return this.request(updateCategoryDef, { id }, () => {
      const current = this.findCategory(id)
      const name = this.validateCategory(input, current, false)
      const updated: Category = {
        ...current,
        ...(name !== undefined && { name }),
        ...(input.parentId !== undefined && { parentId: input.parentId }),
        updatedAt: new Date().toISOString(),
      }
      this.db.categories = this.db.categories.map((c) => (c.id === id ? updated : c))
      return { data: updated }
    })
  }

  deleteCategory(id: string): Promise<DataResponse<DeleteCategoryResult>> {
    return this.request(deleteCategoryDef, { id }, () => {
      const target = this.findCategory(id)
      const doomed = subtree(this.db.categories, id)
      const movedNoteIds: string[] = []
      const now = new Date().toISOString()
      this.db.categories = this.db.categories.filter((c) => !doomed.has(c.id))
      this.db.notes = this.db.notes.map((n) => {
        if (!n.categoryId || !doomed.has(n.categoryId)) return n
        movedNoteIds.push(n.id)
        return { ...n, categoryId: target.parentId, updatedAt: now }
      })
      return { data: { id, deletedCategoryIds: [...doomed], movedNoteIds, movedTo: target.parentId } }
    })
  }

  /* ----- Notes ----- */

  listNotes(): Promise<ListResponse<Note>> {
    return this.request(listNotesDef, {}, () => {
      const data = [...this.db.notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(this.withAttachments)
      return { data, meta: { total: data.length } }
    })
  }

  getNote(id: string): Promise<DataResponse<Note>> {
    return this.request(getNoteDef, { id }, () => ({ data: this.withAttachments(this.findNote(id)) }))
  }

  createNote(input: CreateNoteInput): Promise<DataResponse<Note>> {
    return this.request(createNoteDef, {}, () => {
      const clean = this.validateNote(input, null)
      const now = new Date().toISOString()
      const note: StoredNote = {
        id: crypto.randomUUID(),
        title: clean.title!,
        summary: clean.summary ?? null,
        body: clean.body ?? '',
        categoryId: clean.categoryId ?? null,
        createdAt: now,
        updatedAt: now,
      }
      this.db.notes.unshift(note)
      this.claim(note.id, clean.attachmentIds ?? [], note.body)
      return { data: this.withAttachments(note) }
    })
  }

  updateNote(id: string, input: UpdateNoteInput): Promise<DataResponse<Note>> {
    return this.request(updateNoteDef, { id }, () => {
      const current = this.findNote(id)
      const { attachmentIds, ...clean } = this.validateNote(input, current)
      const updated: StoredNote = { ...current, ...clean, updatedAt: new Date().toISOString() }
      this.db.notes = this.db.notes.map((n) => (n.id === id ? updated : n))
      this.claim(id, attachmentIds ?? [], clean.body)
      if (clean.body !== undefined) {
        const refs = referencedAssetIds(clean.body)
        this.dropAttachments((a) => a.noteId === id && a.embedded && !refs.has(a.id))
      }
      return { data: this.withAttachments(updated) }
    })
  }

  deleteNote(id: string): Promise<void> {
    return this.request(deleteNoteDef, { id }, () => {
      this.findNote(id)
      this.db.notes = this.db.notes.filter((n) => n.id !== id)
      this.dropAttachments((a) => a.noteId === id)
    })
  }

  /* ----- Attachments ----- */

  async uploadAttachments({ files, noteId, embedded = false }: UploadInput, onProgress?: ProgressListener): Promise<ListResponse<Attachment>> {
    // Measure images before the "request", the way the server reads them on arrival.
    const sizes = await Promise.all(files.map((f) => (kindOf(f.type, f.name) === 'image' ? imageSize(f) : null)))
    onProgress?.(0)
    const tick = window.setInterval(() => onProgress?.(Math.min(0.95, Math.random() * 0.3 + 0.5)), 200)
    try {
      return await this.request(uploadDef, {}, () => {
        const details: FieldError[] = []
        if (!files.length) details.push({ field: 'files', message: 'Choose at least one file to upload.' })
        if (noteId && !this.db.notes.some((n) => n.id === noteId)) details.push({ field: 'noteId', message: 'That note no longer exists.' })
        for (const f of files) {
          if (embedded && kindOf(f.type, f.name) !== 'image')
            details.push({ field: 'files', message: `"${f.name}" isn't an image, so it can't be placed in the note body.` })
        }
        if (details.length) throw new ApiError('VALIDATION_FAILED', details)

        const now = new Date().toISOString()
        const data = files.map((file, i): Attachment => {
          const kind = kindOf(file.type, file.name)
          const url = URL.createObjectURL(file)
          return {
            id: crypto.randomUUID(),
            noteId: noteId ?? null,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            kind,
            embedded,
            width: sizes[i]?.width ?? null,
            height: sizes[i]?.height ?? null,
            url,
            thumbnailUrl: kind === 'image' && sizes[i] ? url : null,
            createdAt: now,
          }
        })
        this.attachments.push(...data)
        onProgress?.(1)
        return { data, meta: { total: data.length } }
      })
    } finally {
      window.clearInterval(tick)
    }
  }

  deleteAttachment(id: string): Promise<void> {
    return this.request(deleteAttachmentDef, { id }, () => {
      if (!this.attachments.some((a) => a.id === id)) throw new ApiError('NOT_FOUND')
      this.dropAttachments((a) => a.id === id)
    })
  }

  /* ----- Internals ----- */

  private readonly withAttachments = (note: StoredNote): Note => ({
    ...note,
    attachments: this.attachments.filter((a) => a.noteId === note.id),
  })

  private claim(noteId: string, ids: string[], body: string | undefined) {
    for (const id of ids) {
      const a = this.attachments.find((x) => x.id === id)
      if (!a || (a.noteId && a.noteId !== noteId))
        throw new ApiError('VALIDATION_FAILED', [{ field: 'attachmentIds', message: 'One of the attachments no longer exists. Upload it again.' }])
    }
    const refs = body ? referencedAssetIds(body) : new Set<string>()
    this.attachments = this.attachments.map((a) => (a.noteId === null && (ids.includes(a.id) || refs.has(a.id)) ? { ...a, noteId } : a))
  }

  private dropAttachments(match: (a: Attachment) => boolean) {
    for (const a of this.attachments.filter(match)) URL.revokeObjectURL(a.url)
    this.attachments = this.attachments.filter((a) => !match(a))
  }

  /**
   * The single place a "request" happens: delay, maybe fail, run the handler,
   * persist, log. A real implementation replaces this with fetch.
   */
  private async request<T>(def: CallDefinition, params: Record<string, string>, handler: () => T): Promise<T> {
    const path = def.path.replace(/:(\w+)/g, (_, key: string) => encodeURIComponent(params[key] ?? `:${key}`))
    const { minDelayMs, maxDelayMs, errorRate } = this.options
    const delay = minDelayMs + Math.random() * Math.max(0, maxDelayMs - minDelayMs)
    const started = performance.now()

    await new Promise((resolve) => setTimeout(resolve, delay))

    try {
      if (Math.random() < errorRate) {
        const transient = def.errors.filter((code) => ERRORS[code as ErrorCode]?.transient) as ErrorCode[]
        throw new ApiError(transient[Math.floor(Math.random() * transient.length)] ?? 'INTERNAL_ERROR')
      }
      const result = handler()
      this.persist()
      const status = result === undefined ? 204 : def.method === 'POST' ? 201 : 200
      this.log(def.method, path, def.name, status, started)
      // Hand back a copy, as a network response would be: callers can't mutate the mock DB.
      return result == null ? result : structuredClone(result)
    } catch (error) {
      if (error instanceof ApiError) this.log(def.method, path, def.name, error.status, started, error.body)
      throw error
    }
  }

  private log(method: string, path: string, name: string, status: number, started: number, body?: unknown) {
    if (!this.options.log) return
    const secs = ((performance.now() - started) / 1000).toFixed(1)
    const line = `[mock api] ${method} ${path} → ${status} (${secs}s) ${name}`
    if (status >= 400) console.warn(line, body)
    else console.info(line)
  }

  private persist() {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(this.db))
    } catch {
      /* storage unavailable or full — data lasts for this session only */
    }
  }

  private findCategory(id: string): Category {
    const found = this.db.categories.find((c) => c.id === id)
    if (!found) throw new ApiError('NOT_FOUND')
    return found
  }

  private findNote(id: string): StoredNote {
    const found = this.db.notes.find((n) => n.id === id)
    if (!found) throw new ApiError('NOT_FOUND')
    return found
  }

  /** Validates a category body; returns the trimmed name if one was sent. */
  private validateCategory(input: UpdateCategoryInput, current: Category | null, isCreate: boolean): string | undefined {
    const details: FieldError[] = []
    const name = input.name?.trim()
    const parentId = input.parentId !== undefined ? input.parentId : (current?.parentId ?? null)

    if (isCreate || input.name !== undefined) {
      if (!name) details.push({ field: 'name', message: 'Give the category a name.' })
      else if (name.length > CATEGORY_FIELDS.name.maxLength)
        details.push({ field: 'name', message: `Keep the name under ${CATEGORY_FIELDS.name.maxLength} characters.` })
    }
    if (parentId !== null && !this.db.categories.some((c) => c.id === parentId)) {
      details.push({ field: 'parentId', message: 'The parent category no longer exists.' })
    }
    if (current && parentId !== null && subtree(this.db.categories, current.id).has(parentId)) {
      details.push({ field: 'parentId', message: "A category can't be moved inside itself." })
    }
    if (details.length) throw new ApiError('VALIDATION_FAILED', details)

    const finalName = name ?? current!.name
    const clash = this.db.categories.find((c) => c.id !== current?.id && c.parentId === parentId && sameText(c.name, finalName))
    if (clash) {
      const parent = this.db.categories.find((c) => c.id === parentId)
      throw new ApiError('DUPLICATE_CATEGORY', [
        { field: 'name', message: `"${clash.name}" is already in ${parent ? parent.name : 'your top-level categories'}.` },
      ])
    }
    return name
  }

  /** Validates a note body; returns only the fields that were sent, cleaned. */
  private validateNote(input: UpdateNoteInput, current: StoredNote | null): UpdateNoteInput {
    const details: FieldError[] = []
    const clean: UpdateNoteInput = {}
    const isCreate = current === null

    if (isCreate || input.title !== undefined) {
      const title = input.title?.trim() ?? ''
      if (!title) details.push({ field: 'title', message: 'Add a title so you can find this note later.' })
      else if (title.length > NOTE_FIELDS.title.maxLength)
        details.push({ field: 'title', message: `Keep the title under ${NOTE_FIELDS.title.maxLength} characters.` })
      clean.title = title
    }
    if (input.summary !== undefined) {
      const summary = input.summary?.trim() || null
      if (summary && summary.length > NOTE_FIELDS.summary.maxLength)
        details.push({ field: 'summary', message: `Keep the summary under ${NOTE_FIELDS.summary.maxLength} characters.` })
      clean.summary = summary
    }
    if (input.body !== undefined) {
      if (input.body.length > NOTE_FIELDS.body.maxLength)
        details.push({ field: 'body', message: 'The note body is too large. Move big images into attachments.' })
      clean.body = isEmptyBody(input.body) ? '' : input.body
    }
    if (input.categoryId !== undefined) {
      if (input.categoryId !== null && !this.db.categories.some((c) => c.id === input.categoryId))
        details.push({ field: 'categoryId', message: 'That category no longer exists. Pick another.' })
      clean.categoryId = input.categoryId
    }
    if (input.attachmentIds !== undefined) clean.attachmentIds = input.attachmentIds
    if (details.length) throw new ApiError('VALIDATION_FAILED', details)
    return clean
  }
}
