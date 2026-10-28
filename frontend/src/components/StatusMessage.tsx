import type { ReactNode } from 'react'

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <p className="status status--loading" role="status">
      {label}
    </p>
  )
}

export function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="status status--error" role="alert">
      <span>
        <strong>Error:</strong> {message}
      </span>
      {onRetry && (
        <button type="button" className="button button--secondary" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}

export function SuccessMessage({ children }: { children: ReactNode }) {
  return (
    <p className="status status--success" role="status">
      <strong>Done:</strong> {children}
    </p>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="status status--empty">{children}</p>
}
