import { useId, type ReactNode } from 'react'

export interface ControlProps {
  id: string
  'aria-invalid': boolean
  'aria-describedby': string | undefined
}

interface FormFieldProps {
  label: string
  error?: string
  hint?: string
  required?: boolean
  /** Render the input/select, spreading the provided props onto it so the label and messages are linked. */
  children: (props: ControlProps) => ReactNode
}

export function FormField({ label, error, hint, required, children }: FormFieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={`field${error ? ' field--invalid' : ''}`}>
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {hint && (
        <small id={hintId} className="field__hint" aria-live="polite">
          {hint}
        </small>
      )}
      {error && (
        <small id={errorId} className="field__error">
          {error}
        </small>
      )}
    </div>
  )
}
