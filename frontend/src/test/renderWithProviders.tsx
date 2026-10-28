import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import type { Role } from '../api/types'
import { AuthContext, type AuthContextValue } from '../auth/authContextValue'

interface Options {
  /** Signed-in role, or null for a signed-out user. Defaults to Staff. */
  role?: Role | null
  /** Initial URL, e.g. '/orders/5'. */
  route?: string
  /** Route pattern the UI is mounted at, e.g. '/orders/:id' (needed for useParams). */
  path?: string
  auth?: Partial<AuthContextValue>
}

/** Renders UI inside a router and a stubbed auth context. Mock the API layer (src/api/warehouseApi) in tests. */
export function renderWithProviders(ui: ReactElement, { role = 'Staff', route = '/', path = '*', auth = {} }: Options = {}) {
  const value: AuthContextValue = {
    user: role ? { username: role === 'Admin' ? 'admin' : 'staff', role } : null,
    login: vi.fn(),
    logout: vi.fn(),
    ...auth,
  }

  return {
    auth: value,
    ...render(
      <AuthContext.Provider value={value}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path={path} element={ui} />
            <Route path="/login" element={<p>Login page</p>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    ),
  }
}
