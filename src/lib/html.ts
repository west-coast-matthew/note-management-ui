/**
 * Helpers for note bodies (HTML from the rich text editor).
 *
 * The API stores images from the asset directory with a relative src
 * (/api/attachments/<id>/content), so a body stays valid wherever the API is hosted.
 * The UI may talk to the API on another origin (VITE_API_BASE_URL), so the service
 * layer resolves those paths on the way in and makes them relative again on the way out.
 */

const ASSET_PATH = /(["'(])\/api\/attachments\//g

export const resolveAssetUrls = (html: string, base: string) => (base ? html.replace(ASSET_PATH, `$1${base}/api/attachments/`) : html)

export function relativizeAssetUrls(html: string, base: string) {
  if (!base) return html
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return html.replace(new RegExp(`(["'(])${escaped}/api/attachments/`, 'g'), '$1/api/attachments/')
}

/** Ids of stored assets a body shows. */
export function referencedAssetIds(html: string): Set<string> {
  return new Set([...html.matchAll(/\/api\/attachments\/([0-9a-f-]{36})\//gi)].map((m) => m[1].toLowerCase()))
}

const textCache = new Map<string, string>()

/** The body as plain text, for search and card excerpts. */
export function plainText(html: string): string {
  if (!html) return ''
  const cached = textCache.get(html)
  if (cached !== undefined) return cached
  const doc = new DOMParser().parseFromString(html.replace(/<\/(p|h\d|li|pre|blockquote)>/gi, '$& '), 'text/html')
  const text = (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (textCache.size > 500) textCache.clear()
  textCache.set(html, text)
  return text
}

/** True when the editor holds nothing worth saving ("<p></p>"). */
export const isEmptyBody = (html: string) => !plainText(html) && !/<(img|hr)\b/i.test(html)
