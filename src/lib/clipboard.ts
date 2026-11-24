/**
 * Writes rich content to the clipboard: HTML for apps that accept formatting
 * (docs, mail) and plain text for everything else. Falls back to plain text
 * where ClipboardItem is unavailable.
 */
export async function copyRich(html: string, text: string): Promise<void> {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ])
      return
    } catch {
      /* some browsers reject text/html; retry as plain text below */
    }
  }
  await navigator.clipboard.writeText(text)
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** HTML and plain text for a whole note: title, summary, then the body. */
export function noteClipboard(title: string, summary: string, bodyHtml: string, bodyText: string) {
  const html = [`<h1>${escapeHtml(title)}</h1>`, summary && `<p><em>${escapeHtml(summary)}</em></p>`, bodyHtml].filter(Boolean).join('\n')
  const text = [title, summary, bodyText.trim()].filter(Boolean).join('\n\n')
  return { html, text }
}

/**
 * HTML and plain text for the current selection. Selection.toString() keeps the
 * line breaks between blocks, which Range.toString() drops.
 */
export function selectionClipboard(sel: Selection) {
  const holder = document.createElement('div')
  for (let i = 0; i < sel.rangeCount; i++) holder.appendChild(sel.getRangeAt(i).cloneContents())
  return { html: holder.innerHTML, text: sel.toString() }
}
