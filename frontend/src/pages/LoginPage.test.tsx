import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import type { Role, Session } from '../api/types'
import { AuthContext, type AuthContextValue } from '../auth/authContextValue'
import { LoginPage } from './LoginPage'

function sessionFor(role: Role): Session {
  return { username: role.toLowerCase(), role, expiresAtUtc: new Date(Date.now() + 60_000).toISOString() }
}

/** Signed-out user on /login, with the role home pages mounted so navigation can be asserted. */
function renderLogin(login: AuthContextValue['login']) {
  const value: AuthContextValue = { user: null, login, logout: vi.fn() }
  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin/items" element={<p>Admin items home</p>} />
          <Route path="/inventory" element={<p>Staff inventory home</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

const usernameInput = () => screen.getByLabelText(/Username/)
const passwordInput = () => screen.getByLabelText(/Password/)

describe('LoginPage', () => {
  it('shows required-field messages and does not call login when empty', async () => {
    const login = vi.fn()
    renderLogin(login)

    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByText('Username is required.')).toBeInTheDocument()
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
    expect(usernameInput()).toHaveAttribute('aria-invalid', 'true')
    expect(login).not.toHaveBeenCalled()
  })

  it('treats a whitespace-only username as missing', async () => {
    const login = vi.fn()
    renderLogin(login)

    await userEvent.type(usernameInput(), '   ')
    await userEvent.type(passwordInput(), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByText('Username is required.')).toBeInTheDocument()
    expect(screen.queryByText('Password is required.')).not.toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })

  it.each([
    ['Admin', 'Admin items home'],
    ['Staff', 'Staff inventory home'],
  ] as const)('navigates a successful %s login to the role home', async (role, homeText) => {
    const login = vi.fn().mockResolvedValue(sessionFor(role))
    renderLogin(login)

    await userEvent.type(usernameInput(), '  user1  ')
    await userEvent.type(passwordInput(), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText(homeText)).toBeInTheDocument()
    expect(login).toHaveBeenCalledWith('user1', 'secret')
  })

  it('shows the error, clears the password and keeps the username when login fails', async () => {
    const login = vi.fn().mockRejectedValue(new ApiError(401, 'Invalid username or password.'))
    renderLogin(login)

    await userEvent.type(usernameInput(), 'admin')
    await userEvent.type(passwordInput(), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid username or password.')
    expect(passwordInput()).toHaveValue('')
    expect(usernameInput()).toHaveValue('admin')
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  it('disables the submit button while the login is pending', async () => {
    let resolveLogin: (session: Session) => void = () => {}
    const login = vi.fn(() => new Promise<Session>((resolve) => (resolveLogin = resolve)))
    renderLogin(login)

    await userEvent.type(usernameInput(), 'staff')
    await userEvent.type(passwordInput(), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled()

    resolveLogin(sessionFor('Staff'))
    expect(await screen.findByText('Staff inventory home')).toBeInTheDocument()
  })
})
