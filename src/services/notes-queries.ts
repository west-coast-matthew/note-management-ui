/**
 * TanStack Query hooks over the note management service. UI code talks to the
 * backend only through these; none of it calls the service directly.
 *
 * Mutations write the server's response straight into the query cache instead of
 * refetching, so a save costs one round trip, not two.
 */
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Attachment, Category, CreateCategoryInput, Note, NoteDraft, UpdateCategoryInput, UploadInput } from '../types'
import { ApiError, type ProgressListener } from './contract'
import { noteService as api } from './notes-client'

export const queryKeys = {
  categories: ['categories'] as const,
  category: (id: string) => ['categories', id] as const,
  notes: ['notes'] as const,
  note: (id: string) => ['notes', id] as const,
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // No silent retries: errors surface at once and the UI offers "Try again".
        retry: false,
        refetchOnWindowFocus: false,
        staleTime: 60_000,
      },
      mutations: { retry: false },
    },
  })
}

/* ---------- Queries ---------- */

export const useCategories = () => useQuery({ queryKey: queryKeys.categories, queryFn: async () => (await api.listCategories()).data })

export const useNotes = () => useQuery({ queryKey: queryKeys.notes, queryFn: async () => (await api.listNotes()).data })

export const useNote = (id: string) => useQuery({ queryKey: queryKeys.note(id), queryFn: async () => (await api.getNote(id)).data })

/* ---------- Cache helpers ---------- */

const upsert = <T extends { id: string }>(list: T[] | undefined, item: T, prepend = false) => {
  if (!list) return list
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : prepend ? [item, ...list] : [...list, item]
}

function useStoreNote() {
  const qc = useQueryClient()
  return (note: Note, prepend = false) => {
    qc.setQueryData<Note[]>(queryKeys.notes, (list) => upsert(list, note, prepend))
    qc.setQueryData(queryKeys.note(note.id), note)
  }
}

/* ---------- Note mutations ---------- */

export interface SaveNoteVariables {
  /** Existing note id when editing; omitted when creating. */
  id?: string
  draft: NoteDraft
  /** Attachments the user removed in the editor. Deleted only once the save succeeds. */
  removeAttachmentIds?: string[]
}

/** Create or update a note, then delete any attachments removed in the editor. */
export function useSaveNote() {
  const store = useStoreNote()
  return useMutation({
    mutationFn: async ({ id, draft, removeAttachmentIds = [] }: SaveNoteVariables) => {
      const note = id ? (await api.updateNote(id, draft)).data : (await api.createNote(draft)).data
      const removed = new Set<string>()
      for (const attachmentId of removeAttachmentIds) {
        try {
          await api.deleteAttachment(attachmentId)
          removed.add(attachmentId)
        } catch (error) {
          // Already gone is as good as deleted.
          if (error instanceof ApiError && error.code === 'NOT_FOUND') removed.add(attachmentId)
          else throw error
        }
      }
      return { ...note, attachments: note.attachments.filter((a) => !removed.has(a.id)) }
    },
    onSuccess: (note, { id }) => store(note, !id),
  })
}

export function useDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteNote(id),
    onSuccess: (_, id) => {
      qc.setQueryData<Note[]>(queryKeys.notes, (list) => list?.filter((n) => n.id !== id))
      qc.removeQueries({ queryKey: queryKeys.note(id) })
    },
  })
}

/* ---------- Attachments ---------- */

/** Upload files; staged unless input.noteId is set. Not cached: the caller decides where the results go. */
export const uploadAttachments = async (input: UploadInput, onProgress?: ProgressListener): Promise<Attachment[]> =>
  (await api.uploadAttachments(input, onProgress)).data

/** Drop files onto an existing note: uploads them straight to it and adds them to the cached note. */
export function useAttachToNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, files }: { noteId: string; files: File[] }) => uploadAttachments({ noteId, files }),
    onSuccess: (added, { noteId }) => {
      const add = (n: Note) => (n.id === noteId ? { ...n, attachments: [...n.attachments, ...added] } : n)
      qc.setQueryData<Note[]>(queryKeys.notes, (list) => list?.map(add))
      qc.setQueryData<Note>(queryKeys.note(noteId), (n) => n && add(n))
    },
  })
}

/* ---------- Category mutations ---------- */

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateCategoryInput) => (await api.createCategory(input)).data,
    onSuccess: (category) => qc.setQueryData<Category[]>(queryKeys.categories, (list) => upsert(list, category)),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateCategoryInput }) => (await api.updateCategory(id, input)).data,
    onSuccess: (category) => {
      qc.setQueryData<Category[]>(queryKeys.categories, (list) => upsert(list, category))
      qc.setQueryData(queryKeys.category(category.id), category)
    },
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api.deleteCategory(id)).data,
    onSuccess: (result) => {
      const deleted = new Set(result.deletedCategoryIds)
      const moved = new Set(result.movedNoteIds)
      qc.setQueryData<Category[]>(queryKeys.categories, (list) => list?.filter((c) => !deleted.has(c.id)))
      qc.setQueryData<Note[]>(queryKeys.notes, (list) => list?.map((n) => (moved.has(n.id) ? { ...n, categoryId: result.movedTo } : n)))
      for (const id of deleted) qc.removeQueries({ queryKey: queryKeys.category(id) })
    },
  })
}
