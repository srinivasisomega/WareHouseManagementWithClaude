import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import type { Role } from '../api/types'
import { homePathFor, useAuth } from './useAuth'

interface RequireRoleProps {
  roles: Role[]
  children: ReactNode
}

/** Sends signed-out users to the login page and blocks roles that may not use the route. */
export function RequireRole({ roles, children }: RequireRoleProps) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!roles.includes(user.role)) {
    return (
      <section className="card" aria-labelledby="forbidden-title">
        <h1 id="forbidden-title">Access denied</h1>
        <p>Your account ({user.role}) cannot open this page.</p>
        <Link to={homePathFor(user.role)}>Go to your home page</Link>
      </section>
    )
  }

  return <>{children}</>
}
