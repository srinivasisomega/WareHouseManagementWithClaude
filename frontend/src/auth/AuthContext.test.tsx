import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { authApi } from '../api/warehouseApi'
import { AuthProvider } from './AuthContext'
import { useAuth } from './useAuth'

vi.mock('../api/warehouseApi', () => ({
  authApi: { login: vi.fn(), me: vi.fn(), logout: vi.fn() },
}))

const session = { username: 'staff', role: 'Staff' as const, expiresAtUtc: '2099-01-01T00:00:00Z' }

function Probe() {
  const { user, login, logout } = useAuth()
  return (
    <div>
      <p>{user ? `Signed in as ${user.username} (${user.role})` : 'Signed out'}</p>
      <button type="button" onClick={() => login('staff', 'pw')}>
        Log in
      </button>
      <button type="button" onClick={logout}>
        Log out
      </button>
    </div>
  )
}

const renderProvider = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.mocked(authApi.logout).mockResolvedValue(undefined)
  })

  it('restores the session from the HttpOnly cookie via /auth/me', async () => {
    vi.mocked(authApi.me).mockResolvedValue(session)

    renderProvider()

    expect(screen.getByRole('status')).toHaveTextContent('Checking your session')
    expect(await screen.findByText('Signed in as staff (Staff)')).toBeInTheDocument()
  })

  it('starts signed out when there is no valid session cookie', async () => {
    vi.mocked(authApi.me).mockRejectedValue(new ApiError(401, 'Unauthorized'))

    renderProvider()

    expect(await screen.findByText('Signed out')).toBeInTheDocument()
  })

  it('signs in without writing anything to web storage', async () => {
    vi.mocked(authApi.me).mockRejectedValue(new ApiError(401, 'Unauthorized'))
    vi.mocked(authApi.login).mockResolvedValue(session)
    renderProvider()
    await screen.findByText('Signed out')

    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByText('Signed in as staff (Staff)')).toBeInTheDocument()
    expect(sessionStorage.length).toBe(0)
    expect(localStorage.length).toBe(0)
  })

  it('logs out locally and asks the API to clear the cookie', async () => {
    vi.mocked(authApi.me).mockResolvedValue(session)
    renderProvider()
    await screen.findByText('Signed in as staff (Staff)')

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }))

    expect(screen.getByText('Signed out')).toBeInTheDocument()
    await waitFor(() => expect(authApi.logout).toHaveBeenCalledTimes(1))
  })
})
