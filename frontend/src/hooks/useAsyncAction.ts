import { useCallback, useState } from 'react'
import { ApiError, errorMessage, type FieldErrors } from '../api/client'

export interface AsyncAction<TArgs extends unknown[], TResult> {
  /** Runs the action; resolves to the result, or undefined when it failed (error state is set instead). */
  run: (...args: TArgs) => Promise<TResult | undefined>
  pending: boolean
  error: string | null
  fieldErrors: FieldErrors
  reset: () => void
}

/** Tracks the pending/error state of a mutation such as a form submit. */
export function useAsyncAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
): AsyncAction<TArgs, TResult> {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const reset = useCallback(() => {
    setError(null)
    setFieldErrors({})
  }, [])

  const run = useCallback(
    async (...args: TArgs) => {
      setPending(true)
      reset()
      try {
        return await action(...args)
      } catch (err) {
        setError(errorMessage(err))
        if (err instanceof ApiError) setFieldErrors(err.fieldErrors)
        return undefined
      } finally {
        setPending(false)
      }
    },
    [action, reset],
  )

  return { run, pending, error, fieldErrors, reset }
}
