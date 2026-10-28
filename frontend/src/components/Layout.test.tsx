import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../test/renderWithProviders'
import { Layout } from './Layout'

const nav = () => screen.getByRole('navigation', { name: 'Main' })

describe('Layout', () => {
  it('shows Admin and Operations navigation to an admin', () => {
    renderWithProviders(<Layout />, { role: 'Admin', route: '/admin/items' })

    expect(within(nav()).getByText('Admin')).toBeInTheDocument()
    expect(within(nav()).getByText('Operations')).toBeInTheDocument()
    expect(within(nav()).getByRole('link', { name: 'Items & SKUs' })).toHaveAttribute('href', '/admin/items')
    expect(within(nav()).getByRole('link', { name: 'Locations' })).toHaveAttribute('href', '/admin/locations')
    expect(within(nav()).getByRole('link', { name: 'Stock alerts' })).toHaveAttribute('href', '/admin/thresholds')
    expect(within(nav()).getByRole('link', { name: 'Inventory' })).toHaveAttribute('href', '/inventory')
  })

  it('does not show admin links to staff', () => {
    renderWithProviders(<Layout />, { role: 'Staff', route: '/inventory' })

    expect(within(nav()).getByText('Warehouse')).toBeInTheDocument()
    expect(within(nav()).queryByText('Admin')).not.toBeInTheDocument()
    expect(within(nav()).queryByRole('link', { name: 'Items & SKUs' })).not.toBeInTheDocument()
    expect(within(nav()).queryByRole('link', { name: 'Locations' })).not.toBeInTheDocument()
    expect(within(nav()).queryByRole('link', { name: 'Stock alerts' })).not.toBeInTheDocument()
    expect(within(nav()).getByRole('link', { name: 'Alerts' })).toHaveAttribute('href', '/alerts')
  })

  it('shows the signed-in user and signs out via logout', async () => {
    const { auth } = renderWithProviders(<Layout />, { role: 'Staff', route: '/inventory' })

    expect(screen.getByText('(Staff)')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(auth.logout).toHaveBeenCalledTimes(1)
  })

  it('offers a skip link that targets the main content', () => {
    renderWithProviders(<Layout />, { role: 'Staff', route: '/inventory' })

    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#main-content')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
  })
})
