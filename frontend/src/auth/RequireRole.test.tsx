import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../test/renderWithProviders'
import { RequireRole } from './RequireRole'

const guarded = (
  <RequireRole roles={['Admin']}>
    <p>Secret admin content</p>
  </RequireRole>
)

describe('RequireRole', () => {
  it('redirects a signed-out user to /login', () => {
    renderWithProviders(guarded, { role: null, route: '/admin/items' })

    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('Secret admin content')).not.toBeInTheDocument()
  })

  it('shows "Access denied" for a role that is not allowed', () => {
    renderWithProviders(guarded, { role: 'Staff', route: '/admin/items' })

    expect(screen.getByRole('heading', { name: 'Access denied' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to your home page' })).toHaveAttribute('href', '/inventory')
    expect(screen.queryByText('Secret admin content')).not.toBeInTheDocument()
  })

  it('renders children for an allowed role', () => {
    renderWithProviders(guarded, { role: 'Admin', route: '/admin/items' })

    expect(screen.getByText('Secret admin content')).toBeInTheDocument()
    expect(screen.queryByText('Access denied')).not.toBeInTheDocument()
  })
})
