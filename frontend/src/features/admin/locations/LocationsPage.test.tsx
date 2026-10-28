import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../api/client'
import type { Location } from '../../../api/types'
import { locationsApi } from '../../../api/warehouseApi'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { LocationsPage } from './LocationsPage'

vi.mock('../../../api/warehouseApi', () => ({
  locationsApi: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
}))

const list = vi.mocked(locationsApi.list)
const create = vi.mocked(locationsApi.create)
const update = vi.mocked(locationsApi.update)

const aisle: Location = { id: 1, code: 'A-01', name: 'Aisle 1', description: null, isActive: true }
const dock: Location = { id: 2, code: 'DOCK-1', name: 'Receiving dock', description: 'Inbound', isActive: false }

function renderPage() {
  return renderWithProviders(<LocationsPage />, { role: 'Admin', route: '/admin/locations' })
}

describe('LocationsPage', () => {
  beforeEach(() => {
    list.mockReset()
    create.mockReset()
    update.mockReset()
  })

  it('lists active and inactive locations', async () => {
    list.mockResolvedValue([aisle, dock])
    renderPage()

    const aisleRow = (await screen.findByText('A-01')).closest('tr')!
    expect(within(aisleRow).getByText('Aisle 1')).toBeInTheDocument()
    expect(within(aisleRow).getByText('—')).toBeInTheDocument()
    expect(within(aisleRow).getByText('Active')).toBeInTheDocument()

    const dockRow = screen.getByText('DOCK-1').closest('tr')!
    expect(within(dockRow).getByText('Inbound')).toBeInTheDocument()
    expect(within(dockRow).getByText('Inactive')).toBeInTheDocument()
    expect(list).toHaveBeenCalledWith({ includeInactive: true })
  })

  it('shows the empty state when there are no locations', async () => {
    list.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('No locations yet. Add a receiving dock and storage bins to start.')).toBeInTheDocument()
  })

  it('validates the create form without calling the API', async () => {
    list.mockResolvedValue([aisle])
    renderPage()
    await screen.findByText('A-01')
    await userEvent.click(screen.getByRole('button', { name: 'Add location' }))

    await userEvent.click(screen.getByRole('button', { name: 'Save location' }))

    expect(screen.getByText('Code is required.')).toBeInTheDocument()
    expect(screen.getByText('Name is required.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/^Code/), 'A 01')
    await userEvent.type(screen.getByLabelText(/^Name/), 'Aisle')
    await userEvent.click(screen.getByRole('button', { name: 'Save location' }))

    expect(screen.getByText("Code may contain only letters, digits, '.', '_' and '-'.")).toBeInTheDocument()
    expect(screen.queryByText('Name is required.')).not.toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it('creates a location and shows a success message', async () => {
    list.mockResolvedValue([aisle])
    create.mockResolvedValue({ id: 3, code: 'B-02', name: 'Bin B2', description: null, isActive: true })
    renderPage()
    await screen.findByText('A-01')
    await userEvent.click(screen.getByRole('button', { name: 'Add location' }))

    await userEvent.type(screen.getByLabelText(/^Code/), ' B-02 ')
    await userEvent.type(screen.getByLabelText(/^Name/), 'Bin B2')
    await userEvent.click(screen.getByRole('button', { name: 'Save location' }))

    expect(await screen.findByText('Location B-02 saved.')).toBeInTheDocument()
    expect(create).toHaveBeenCalledWith({ code: 'B-02', name: 'Bin B2', description: null, isActive: true })
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
  })

  it('shows the server business-rule message when deactivating a location that holds stock', async () => {
    list.mockResolvedValue([aisle])
    update.mockRejectedValue(new ApiError(422, 'Location A-01 still holds stock and cannot be deactivated.'))
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Edit A-01' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Active' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save location' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Location A-01 still holds stock and cannot be deactivated.')
    expect(update).toHaveBeenCalledWith(1, { code: 'A-01', name: 'Aisle 1', description: null, isActive: false })
    // The form stays open with the user's change preserved.
    expect(screen.getByRole('heading', { name: 'Edit A-01' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Active' })).not.toBeChecked()
  })
})
