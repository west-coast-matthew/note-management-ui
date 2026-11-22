/**
 * Chooses the backend the app talks to.
 *
 * - VITE_API_BASE_URL set (e.g. http://127.0.0.1:3002): real calls to that API.
 * - Not set or empty: the mock service, backed by the JSON files in mock-data/.
 *
 * Vite reads it from .env, .env.local or the shell when the dev server starts or the
 * app is built, so restart `npm run dev` after changing it.
 */
import type { NoteManagementApi } from './contract'
import { HttpNoteManagementService } from './notes-http'
import { NoteManagementService } from './notes-mock'

const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim()

export const apiMode: 'http' | 'mock' = baseUrl ? 'http' : 'mock'

function createService(): NoteManagementApi {
  if (baseUrl) {
    if (import.meta.env.DEV) console.info(`[api] using ${baseUrl}`)
    return new HttpNoteManagementService(baseUrl)
  }
  const mock = new NoteManagementService()
  if (import.meta.env.DEV) {
    console.info('[api] VITE_API_BASE_URL is not set; using the mock API from mock-data/')
    // Exposed for poking at from the console, e.g. mockApi.configure({ errorRate: 1 }).
    ;(window as unknown as { mockApi: NoteManagementService }).mockApi = mock
  }
  return mock
}

/** The app-wide service instance. */
export const noteService: NoteManagementApi = createService()
