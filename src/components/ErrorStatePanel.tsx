import type { ReactNode } from 'react'
import { Button } from './form'
import { Icon } from './ui'

/**
 * Shown when a remote request fails.
 *
 * Pass `onRetry` for reads that can be repeated, `onDismiss` for failed writes the user
 * can acknowledge. `retrying` keeps the panel up with a busy Try again button while the
 * retry is in flight. `size` matches LoadingStatePanel so the two can swap in place.
 */
export function ErrorStatePanel({
  title = 'Something went wrong',
  message,
  onRetry,
  retrying,
  onDismiss,
  size = 'regular',
  className,
}: {
  title?: ReactNode
  message?: ReactNode
  onRetry?: () => void
  retrying?: boolean
  onDismiss?: () => void
  size?: 'regular' | 'compact'
  className?: string
}) {
  const compact = size === 'compact'
  return (
    <div
      className={['state-panel', 'state-panel--error', compact && 'state-panel--compact', className].filter(Boolean).join(' ')}
      role="alert"
    >
      <span className="state-panel__icon">
        <Icon name="alert" size={compact ? 16 : 22} />
      </span>
      <div className="state-panel__text">
        <p className="state-panel__title">{title}</p>
        {message && <p className="state-panel__message">{message}</p>}
      </div>
      {(onRetry || onDismiss) && (
        <div className="state-panel__actions">
          {onRetry && (
            <Button variant="primary" onClick={onRetry} loading={retrying}>
              {retrying ? 'Retrying…' : 'Try again'}
            </Button>
          )}
          {onDismiss && (
            <Button onClick={onDismiss} disabled={retrying}>
              Dismiss
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
