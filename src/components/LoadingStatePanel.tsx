import type { ReactNode } from 'react'
import { Spinner } from './form'

/**
 * Shown while a remote request is in flight.
 *
 * `regular` fills an empty area (a list that hasn't loaded yet); `compact` is a single
 * row for tight spots such as the sidebar or a card.
 */
export function LoadingStatePanel({
  title = 'Loading…',
  message,
  size = 'regular',
  className,
}: {
  title?: ReactNode
  message?: ReactNode
  size?: 'regular' | 'compact'
  className?: string
}) {
  const compact = size === 'compact'
  return (
    <div
      className={['state-panel', 'state-panel--loading', compact && 'state-panel--compact', className].filter(Boolean).join(' ')}
      role="status"
      aria-live="polite"
    >
      <span className="state-panel__icon">
        <Spinner size={compact ? 16 : 24} />
      </span>
      <div className="state-panel__text">
        <p className="state-panel__title">{title}</p>
        {message && <p className="state-panel__message">{message}</p>}
      </div>
    </div>
  )
}
