/**
 * Note management over the real REST API (../note-management-api/README.md).
 *
 * Used instead of the mock when VITE_API_BASE_URL is set; see notes-client.ts.
 * Responses are returned in the same shapes the mock returns, so nothing above the
 * service layer can tell the two apart.
 *
 * One difference is bridged here: the API sends file URLs and body image sources as
 * paths relative to itself. They're resolved against the base URL on the way in and
 * made relative again on the way out, so stored bodies don't depend on where the API runs.
 */
import type {
  Attachment,
  Category,
  CreateCategoryInput,
  CreateNoteInput,
  DataResponse,
  DeleteCategoryResult,
  ErrorBody,
  ErrorCode,
  ListResponse,
  Note,
  UpdateCategoryInput,
  UpdateNoteInput,
  UploadInput,
} from '../types'
import { relativizeAssetUrls, resolveAssetUrls } from '../lib/html'
import { ApiError, type NoteManagementApi, type ProgressListener } from './contract'

export class HttpNoteManagementService implements NoteManagementApi {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
  }

  /* ----- Categories ----- */

  listCategories() {
    return this.request<ListResponse<Category>>('GET', '/api/categories')
  }

  getCategory(id: string) {
    return this.request<DataResponse<Category>>('GET', `/api/categories/${encodeURIComponent(id)}`)
  }

  createCategory(input: CreateCategoryInput) {
    return this.request<DataResponse<Category>>('POST', '/api/categories', input)
  }

  updateCategory(id: string, input: UpdateCategoryInput) {
    return this.request<DataResponse<Category>>('PATCH', `/api/categories/${encodeURIComponent(id)}`, input)
  }

  deleteCategory(id: string) {
    return this.request<DataResponse<DeleteCategoryResult>>('DELETE', `/api/categories/${encodeURIComponent(id)}`)
  }

  /* ----- Notes ----- */

  async listNotes(): Promise<ListResponse<Note>> {
    const res = await this.request<ListResponse<Note>>('GET', '/api/notes')
    return { ...res, data: res.data.map(this.noteFromWire) }
  }

  async getNote(id: string): Promise<DataResponse<Note>> {
    const res = await this.request<DataResponse<Note>>('GET', `/api/notes/${encodeURIComponent(id)}`)
    return { data: this.noteFromWire(res.data) }
  }

  async createNote(input: CreateNoteInput): Promise<DataResponse<Note>> {
    const res = await this.request<DataResponse<Note>>('POST', '/api/notes', this.noteToWire(input))
    return { data: this.noteFromWire(res.data) }
  }

  async updateNote(id: string, input: UpdateNoteInput): Promise<DataResponse<Note>> {
    const res = await this.request<DataResponse<Note>>('PATCH', `/api/notes/${encodeURIComponent(id)}`, this.noteToWire(input))
    return { data: this.noteFromWire(res.data) }
  }

  async deleteNote(id: string): Promise<void> {
    await this.request<void>('DELETE', `/api/notes/${encodeURIComponent(id)}`)
  }

  /* ----- Attachments ----- */

  /**
   * multipart/form-data upload. Uses XMLHttpRequest rather than fetch because fetch
   * can't report upload progress, and a bulk drop of large files needs a progress bar.
   */
  uploadAttachments({ files, noteId, embedded }: UploadInput, onProgress?: ProgressListener): Promise<ListResponse<Attachment>> {
    const form = new FormData()
    if (noteId) form.append('noteId', noteId)
    if (embedded) form.append('embedded', 'true')
    for (const file of files) form.append('files', file, file.name)

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${this.baseUrl}/api/attachments`)
      xhr.setRequestHeader('Accept', 'application/json')
      xhr.responseType = 'text'
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
      xhr.onerror = () => reject(this.unreachable())
      xhr.onload = () => {
        let payload: unknown
        try {
          payload = JSON.parse(xhr.responseText)
        } catch {
          payload = undefined
        }
        if (xhr.status >= 200 && xhr.status < 300 && payload) {
          const res = payload as ListResponse<Attachment>
          resolve({ ...res, data: res.data.map(this.attachmentFromWire) })
        } else {
          reject(this.errorFromPayload(xhr.status, payload))
        }
      }
      xhr.send(form)
    })
  }

  async deleteAttachment(id: string): Promise<void> {
    await this.request<void>('DELETE', `/api/attachments/${encodeURIComponent(id)}`)
  }

  /* ----- Wire mapping ----- */

  private readonly attachmentFromWire = (a: Attachment): Attachment => ({
    ...a,
    url: this.baseUrl + a.url,
    thumbnailUrl: a.thumbnailUrl && this.baseUrl + a.thumbnailUrl,
  })

  private readonly noteFromWire = (n: Note): Note => ({
    ...n,
    body: resolveAssetUrls(n.body, this.baseUrl),
    attachments: n.attachments.map(this.attachmentFromWire),
  })

  private noteToWire<T extends UpdateNoteInput>(input: T): T {
    return input.body === undefined ? input : { ...input, body: relativizeAssetUrls(input.body, this.baseUrl) }
  }

  /* ----- Internals ----- */

  private unreachable() {
    // Network failure: server down, wrong address, or blocked by CORS.
    return new ApiError('SERVICE_UNAVAILABLE', undefined, `Can't reach the server at ${this.baseUrl}. Check that the API is running.`, 0)
  }

  private errorFromPayload(status: number, payload: unknown) {
    const error = (payload as Partial<ErrorBody> | undefined)?.error
    if (error?.code) return new ApiError(error.code as ErrorCode, error.details, error.message, status)
    if (status === 413) return new ApiError('FILE_TOO_LARGE', undefined, undefined, status)
    return new ApiError(status >= 500 ? 'INTERNAL_ERROR' : 'NOT_FOUND', undefined, undefined, status)
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        // React Query is the app's cache; skip the HTTP one.
        cache: 'no-store',
        headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      throw this.unreachable()
    }

    if (res.status === 204) return undefined as T
    const payload: unknown = await res.json().catch(() => undefined)
    if (!res.ok) throw this.errorFromPayload(res.status, payload)
    if (payload === undefined) {
      throw new ApiError('INTERNAL_ERROR', undefined, 'The server sent a response the app could not read.', res.status)
    }
    return payload as T
  }
}
