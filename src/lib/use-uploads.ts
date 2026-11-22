import { useCallback, useEffect, useRef, useState } from 'react'
import type { Attachment, UploadInput } from '../types'
import { describeError } from '../services/contract'
import { uploadAttachments } from '../services/notes-queries'
import type { PendingUpload } from '../components/attachments'
import { kindOf } from './files'

/** Files sent at once. Each file is its own request, so one failure doesn't sink the batch. */
const CONCURRENCY = 3

/**
 * Bulk upload with per-file progress. `upload` resolves with the files that made it;
 * failed ones stay in `pending` with their error until dismissed.
 */
export function useUploads() {
  const [pending, setPending] = useState<PendingUpload[]>([])
  const alive = useRef(true)
  useEffect(() => {
    // Set on every mount: StrictMode mounts, unmounts and mounts again in development.
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const patch = useCallback((key: string, change: Partial<PendingUpload>) => {
    if (alive.current) setPending((list) => list.map((p) => (p.key === key ? { ...p, ...change } : p)))
  }, [])

  const upload = useCallback(
    async (files: File[], options: Omit<UploadInput, 'files'> = {}): Promise<Attachment[]> => {
      const jobs = files.map((file) => ({
        file,
        item: {
          key: crypto.randomUUID(),
          fileName: file.name,
          size: file.size,
          kind: kindOf(file.type, file.name),
          progress: 0,
        } satisfies PendingUpload,
      }))
      setPending((list) => [...list, ...jobs.map((j) => j.item)])

      const done: Attachment[] = []
      const queue = [...jobs]
      const worker = async () => {
        for (let job = queue.shift(); job; job = queue.shift()) {
          const { file, item } = job
          try {
            const [attachment] = await uploadAttachments({ ...options, files: [file] }, (p) => patch(item.key, { progress: p }))
            done.push(attachment)
            if (alive.current) setPending((list) => list.filter((p) => p.key !== item.key))
          } catch (error) {
            patch(item.key, { error: describeError(error) })
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker))
      // Keep the order the files were chosen in.
      const order = new Map(files.map((f, i) => [f.name + f.size, i]))
      return done.sort((a, b) => (order.get(a.fileName + a.size) ?? 0) - (order.get(b.fileName + b.size) ?? 0))
    },
    [patch],
  )

  const dismiss = useCallback((key: string) => setPending((list) => list.filter((p) => p.key !== key)), [])
  const busy = pending.some((p) => !p.error)

  return { pending, upload, dismiss, busy }
}
