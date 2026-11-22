/*
 * Resource types. These mirror mock-data/models.json — the API contract — so change
 * that file first and keep these in step.
 */

export interface Category {
  id: string
  name: string
  /** null for a top-level category; otherwise the id of its parent (a subcategory). */
  parentId: string | null
  createdAt: string
  updatedAt: string
}

/** How a file is presented: images get a thumbnail, everything else a placeholder for its kind. */
export type AttachmentKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'other'

export interface Attachment {
  id: string
  /** null while staged: uploaded, but not yet saved with a note. */
  noteId: string | null
  fileName: string
  mimeType: string
  /** Bytes. */
  size: number
  kind: AttachmentKind
  /** true for images placed in the note body; false for files in the attachment list. */
  embedded: boolean
  width: number | null
  height: number | null
  /** Absolute URL of the file (the service layer resolves the API's relative path). */
  url: string
  /** Absolute URL of the WebP thumbnail, images only. */
  thumbnailUrl: string | null
  createdAt: string
}

export interface Note {
  id: string
  title: string
  summary: string | null
  /** Formatted HTML from the rich text editor. */
  body: string
  /** Category or subcategory the note lives in; null = unsorted. */
  categoryId: string | null
  attachments: Attachment[]
  createdAt: string
  updatedAt: string
}

/* ---------- Request bodies ---------- */

export interface CreateNoteInput {
  title: string
  summary?: string | null
  body?: string
  categoryId?: string | null
  /** Staged attachments to file under this note. */
  attachmentIds?: string[]
}
export type UpdateNoteInput = Partial<CreateNoteInput>

export interface CreateCategoryInput {
  name: string
  parentId?: string | null
}
export type UpdateCategoryInput = Partial<CreateCategoryInput>

export interface UploadInput {
  files: File[]
  /** Attach straight to this note; omit to stage the files until the note is saved. */
  noteId?: string
  /** Images placed in the note body rather than listed as attachments. */
  embedded?: boolean
}

/** What the note editor produces. */
export type NoteDraft = Required<Omit<CreateNoteInput, 'attachmentIds'>> & { attachmentIds: string[] }

/* ---------- Response envelopes (mock-data/README.md) ---------- */

export interface DataResponse<T> {
  data: T
}
export interface ListResponse<T> {
  data: T[]
  meta: { total: number }
}
export interface DeleteCategoryResult {
  id: string
  deletedCategoryIds: string[]
  movedNoteIds: string[]
  movedTo: string | null
}

export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'DUPLICATE_CATEGORY'
  | 'FILE_TOO_LARGE'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'

export interface FieldError {
  field: string
  message: string
}
export interface ErrorBody {
  error: { code: ErrorCode; message: string; details?: FieldError[] }
}
