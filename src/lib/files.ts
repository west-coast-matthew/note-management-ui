import type { AttachmentKind } from '../types'

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let n = bytes / 1024
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n < 10 ? n.toFixed(1) : Math.round(n)} ${units[i]}`
}

const TEXT_EXT = /\.(txt|md|markdown|log|csv|tsv|json|ya?ml|toml|ini|conf|cnf|cfg|env|sql|sh|bash|zsh|xml|html?|css|js|ts|tsx|jsx|py|rb|go|rs|java|c|h|cpp|properties)$/i

/** Same rules as the API (src/lib/media.ts there); used by the mock and for upload previews. */
export function kindOf(mimeType: string, fileName: string): AttachmentKind {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType === 'application/pdf' || /\.pdf$/i.test(fileName)) return 'pdf'
  if (mimeType.startsWith('text/') || /json|xml|yaml|sql|x-sh/.test(mimeType) || TEXT_EXT.test(fileName)) return 'text'
  return 'other'
}

export const KIND_LABEL: Record<AttachmentKind, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  pdf: 'PDF',
  text: 'Text',
  other: 'File',
}

/** Short tag shown on placeholder art: the file's extension when it has a short one. */
export function extensionTag(fileName: string, kind: AttachmentKind): string {
  const ext = fileName.includes('.') ? fileName.split('.').pop()!.toUpperCase() : ''
  return ext && ext.length <= 4 ? ext : KIND_LABEL[kind].toUpperCase()
}

/** Files from a drag event, ignoring dragged text and links. */
export const hasFiles = (e: { dataTransfer: DataTransfer | null }) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files')
