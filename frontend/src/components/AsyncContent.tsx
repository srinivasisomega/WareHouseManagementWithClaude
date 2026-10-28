import type { ReactNode } from 'react'
import type { ApiData } from '../hooks/useApiData'
import { EmptyState, ErrorMessage, LoadingState } from './StatusMessage'

interface AsyncContentProps<T> {
  state: ApiData<T>
  loadingLabel?: string
  /** Shown when the loaded data is empty (an empty array by default). */
  empty: ReactNode
  isEmpty?: (data: T) => boolean
  children: (data: T) => ReactNode
}

/**
 * Renders the loading, error, empty or loaded state of a `useApiData` result.
 * Previously loaded data stays visible (marked busy) while a reload is in flight.
 */
export function AsyncContent<T>({ state, loadingLabel, empty, isEmpty, children }: AsyncContentProps<T>) {
  if (state.error) return <ErrorMessage message={state.error} onRetry={state.reload} />
  if (state.data === undefined) return <LoadingState label={loadingLabel} />

  const dataIsEmpty = isEmpty ? isEmpty(state.data) : Array.isArray(state.data) && state.data.length === 0
  if (dataIsEmpty && !state.loading) return <EmptyState>{empty}</EmptyState>

  return <div aria-busy={state.loading}>{children(state.data)}</div>
}
