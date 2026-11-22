import {
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { motion } from 'motion/react'

/**
 * Shared form controls. The app and the /mock/form-controls artboard both render these,
 * so look-and-feel changes made against the artboard land in the app too.
 *
 * `forceState` exists for the artboard: it pins a visual state (focus, hover) that
 * would otherwise need a real pointer or keyboard to see.
 */
export type ForcedState = 'focus' | 'hover'

const cx = (...parts: unknown[]) => parts.filter((p): p is string => typeof p === 'string' && p !== '').join(' ')

/* ---------- Button ---------- */

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'dashed'
  size?: 'md' | 'lg'
  block?: boolean
  /** Shows a spinner, disables the button and sets aria-busy (e.g. while a request is in flight). */
  loading?: boolean
  icon?: ReactNode
  forceState?: ForcedState
}

export function Button({
  variant = 'ghost',
  size = 'md',
  block,
  loading,
  icon,
  forceState,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'btn',
        `btn--${variant}`,
        size === 'lg' && 'btn--lg',
        block && 'btn--block',
        forceState && `is-${forceState}`,
        'mono',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  )
}

export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </motion.svg>
  )
}

/* ---------- Field wrapper ---------- */

interface FieldProps {
  label: ReactNode
  optional?: boolean
  hint?: ReactNode
  error?: ReactNode
  /** Receives the generated id and describedby so the control is wired to its label and messages. */
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
  className?: string
}

export function Field({ label, optional, hint, error, children, className }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = cx(hint && hintId, error && errorId) || undefined
  return (
    <div className={cx('field', className)}>
      <label className="field__label mono" htmlFor={id}>
        {label}
        {optional && <em>optional</em>}
      </label>
      {children({ id, describedBy, invalid: !!error })}
      {hint && !error && (
        <span id={hintId} className="field__hint">
          {hint}
        </span>
      )}
      {error && (
        <motion.span
          id={errorId}
          className="field__error"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
        >
          {error}
        </motion.span>
      )}
    </div>
  )
}

type Common = Pick<FieldProps, 'label' | 'optional' | 'hint' | 'error' | 'className'> & { forceState?: ForcedState }

/* ---------- Text field ---------- */

export function TextField({
  label,
  optional,
  hint,
  error,
  className,
  forceState,
  prefix,
  ...input
}: Common & Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> & { prefix?: ReactNode }) {
  return (
    <Field label={label} optional={optional} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <div className={cx('control', prefix && 'control--prefixed', forceState && `is-${forceState}`)}>
          {prefix && <span className="control__prefix">{prefix}</span>}
          <input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} {...input} />
        </div>
      )}
    </Field>
  )
}

/* ---------- Text area ---------- */

export function TextArea({
  label,
  optional,
  hint,
  error,
  className,
  forceState,
  ...area
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} optional={optional} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <div className={cx('control', forceState && `is-${forceState}`)}>
          <textarea id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} rows={3} {...area} />
        </div>
      )}
    </Field>
  )
}

/* ---------- Select ---------- */

export interface SelectOption {
  value: string
  label: string
  depth?: number
}

export function SelectField({
  label,
  optional,
  hint,
  error,
  className,
  forceState,
  options,
  ...select
}: Common & SelectHTMLAttributes<HTMLSelectElement> & { options: SelectOption[] }) {
  return (
    <Field label={label} optional={optional} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <div className={cx('control control--select', forceState && `is-${forceState}`)}>
          <select id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} {...select}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {'   '.repeat(o.depth ?? 0)}
                {o.depth ? '↳ ' : ''}
                {o.label}
              </option>
            ))}
          </select>
          <svg className="control__caret" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </Field>
  )
}

/* ---------- Checkbox ---------- */

export function Checkbox({
  label,
  checked,
  onChange,
  disabled,
  forceState,
}: {
  label: ReactNode
  checked: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  forceState?: ForcedState
}) {
  return (
    <label className={cx('checkbox', disabled && 'is-disabled', forceState && `is-${forceState}`)}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="checkbox__box" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24">
          <motion.path
            d="M5 12.5l4.5 4.5L19 7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          />
        </svg>
      </span>
      <span className="checkbox__label">{label}</span>
    </label>
  )
}
