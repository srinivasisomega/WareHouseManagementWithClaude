import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { onUnauthorized } from '../api/client'
import type { Session } from '../api/types'
import { authApi } from '../api/warehouseApi'
import { LoadingState } from '../components/StatusMessage'
import { AuthContext, type AuthContextValue } from './authContextValue'

/**
 * Holds the signed-in user in memory only. The JWT is in an HttpOnly cookie set by the API,
 * so nothing auth-related is written to localStorage/sessionStorage. On load the session is
 * restored by asking the API who the cookie belongs to.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [restoring, setRestoring] = useState(true)

  useEffect(() => {
    let cancelled = false
    authApi
      .me()
      .then((restored) => {
        if (!cancelled) setSession(restored)
      })
      .catch(() => {
        // No valid session cookie: stay signed out.
      })
      .finally(() => {
        if (!cancelled) setRestoring(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const logout = useCallback(() => {
    setSession(null)
    // Clearing the HttpOnly cookie needs the server; the UI is signed out regardless of the result.
    authApi.logout().catch(() => {})
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const response = await authApi.login(username, password)
    setSession(response)
    return response
  }, [])

  useEffect(() => {
    // An expired or revoked cookie surfaces as a 401 on any call: drop the in-memory session.
    onUnauthorized(() => setSession(null))
    return () => onUnauthorized(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session ? { username: session.username, role: session.role } : null,
      login,
      logout,
    }),
    [session, login, logout],
  )

  if (restoring) return <LoadingState label="Checking your session…" />

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
