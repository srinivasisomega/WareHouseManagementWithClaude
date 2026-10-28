import { useContext } from 'react'
import { AuthContext, type AuthContextValue } from './authContextValue'

/**
 * Reads the current authentication state.
 * @returns The signed-in user (or null) plus login and logout actions.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.')
  return context
}

/**
 * Only same-app paths are allowed as a post-login destination ("/orders/5"), never another
 * origin ("//evil.example", "https://evil.example", "/\\evil"), so it cannot be an open redirect.
 * @param candidate The requested destination, typically from router state.
 * @returns The path when it is safe, otherwise null.
 */
export function safeRedirectPath(candidate: unknown): string | null {
  if (typeof candidate !== 'string') return null
  const sameAppPath = /^\/(?![/\\])[^\s]*$/.test(candidate)
  return sameAppPath && !candidate.startsWith('/login') ? candidate : null
}

/**
 * Landing page for a role after sign-in.
 * @param role The user's role.
 * @returns The route path for that role's home page.
 */
export function homePathFor(role: string | undefined) {
  return role === 'Admin' ? '/admin/items' : '/inventory'
}
