import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../api/client'

export interface ApiData<T> {
  data: T | undefined
  loading: boolean
  error: string | null
  reload: () => void
}

interface Settled<T> {
  /** Which request (key + reload version) this result belongs to. */
  requestId: string
  data: T | undefined
  error: string | null
}

/**
 * Loads data when `key` changes. `key` should capture every input of `loader`
 * (e.g. a serialized filter object); responses from superseded requests are ignored.
 * Previously loaded data is kept while a new request is in flight.
 */
export function useApiData<T>(loader: () => Promise<T>, key: string = ''): ApiData<T> {
  const [version, setVersion] = useState(0)
  const [settled, setSettled] = useState<Settled<T>>({ requestId: '', data: undefined, error: null })
  const loaderRef = useRef(loader)
  const requestId = `${version}:${key}`

  useEffect(() => {
    loaderRef.current = loader
  })

  useEffect(() => {
    let cancelled = false
    loaderRef
      .current()
      .then((data) => {
        if (!cancelled) setSettled({ requestId, data, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled) setSettled((prev) => ({ requestId, data: prev.data, error: errorMessage(err) }))
      })
    return () => {
      cancelled = true
    }
  }, [requestId])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  const loading = settled.requestId !== requestId

  return { data: settled.data, loading, error: loading ? null : settled.error, reload }
}
