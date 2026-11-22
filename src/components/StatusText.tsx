import type { ReactNode } from 'react'

/**
 * Placeholder loading / error indicator: plain text for now.
 * Every request state in the UI renders through this, so the future loading and
 * error components replace this one file.
 */
export function StatusText({
  tone = 'loading',
  children,
  onRetry,
  onDismiss,
}: {
  tone?: 'loading' | 'error'
  children: ReactNode
  onRetry?: () => void
  onDismiss?: () => void
}) {
  return (
    <p className={`status status--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      )}
      {onDismiss && (
        <button type="button" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </p>
  )
}
