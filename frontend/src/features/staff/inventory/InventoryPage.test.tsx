import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../api/client'
import type { InventoryItem, Location } from '../../../api/types'
import { inventoryApi, locationsApi } from '../../../api/warehouseApi'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { InventoryPage } from './InventoryPage'

vi.mock('../../../api/warehouseApi', () => ({
  inventoryApi: { search: vi.fn(), alerts: vi.fn() },
  locationsApi: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
  itemsApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), updateThreshold: vi.fn() },
}))

const search = vi.mocked(inventoryApi.search)
const listLocations = vi.mocked(locationsApi.list)

const locations: Location[] = [
  { id: 1, code: 'A-01', name: 'Aisle 1', description: null, isActive: true },
  { id: 2, code: 'B-02', name: 'Bin B2', description: null, isActive: true },
]

const bolt: InventoryItem = {
  itemId: 10,
  sku: 'BOLT-10',
  name: 'Hex bolt',
  unitOfMeasure: 'EA',
  totalQuantity: 8,
  lowStockThreshold: 10,
  isLowStock: true,
  locations: [
    { locationId: 1, locationCode: 'A-01', locationName: 'Aisle 1', quantity: 5 },
    { locationId: 2, locationCode: 'B-02', locationName: 'Bin B2', quantity: 3 },
  ],
}
const nut: InventoryItem = {
  itemId: 11,
  sku: 'NUT-5',
  name: 'Nut',
  unitOfMeasure: 'BOX',
  totalQuantity: 0,
  lowStockThreshold: 0,
  isLowStock: false,
  locations: [],
}

function renderPage() {
  return renderWithProviders(<InventoryPage />, { role: 'Staff', route: '/inventory' })
}

describe('InventoryPage', () => {
  beforeEach(() => {
    search.mockReset()
    listLocations.mockReset()
    listLocations.mockResolvedValue(locations)
  })

  it('shows inventory rows with the per-location breakdown', async () => {
    search.mockResolvedValue([bolt, nut])
    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent('Loading inventory…')

    const boltRow = (await screen.findByText('BOLT-10')).closest('tr')!
    expect(within(boltRow).getByText('8 EA')).toBeInTheDocument()
    const breakdown = within(boltRow).getAllByRole('listitem').map((li) => li.textContent)
    expect(breakdown).toEqual(['A-01: 5', 'B-02: 3'])

    const nutRow = screen.getByText('NUT-5').closest('tr')!
    expect(within(nutRow).getByText('None')).toBeInTheDocument()
    // Threshold 0 means alerts are off.
    expect(within(nutRow).getByText('—')).toBeInTheDocument()
  })

  it('labels low-stock rows with a text badge, not colour alone', async () => {
    search.mockResolvedValue([bolt, nut])
    renderPage()

    const boltRow = (await screen.findByText('BOLT-10')).closest('tr')!
    expect(within(boltRow).getByText(/Low stock/)).toBeInTheDocument()
    const nutRow = screen.getByText('NUT-5').closest('tr')!
    expect(within(nutRow).getByText('In stock')).toBeInTheDocument()
  })

  it('requests only low-stock items when "Low stock only" is checked', async () => {
    search.mockResolvedValue([bolt])
    renderPage()
    await screen.findByText('BOLT-10')

    await userEvent.click(screen.getByRole('checkbox', { name: 'Low stock only' }))

    await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ lowStockOnly: true })))
  })

  it('passes the selected location id to the search', async () => {
    search.mockResolvedValue([bolt])
    renderPage()
    await screen.findByText('BOLT-10')
    const select = screen.getByLabelText('Location')
    await screen.findByRole('option', { name: 'B-02 — Bin B2' })

    await userEvent.selectOptions(select, 'B-02 — Bin B2')

    await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ locationId: 2 })))
  })

  it('shows the empty state when no items match', async () => {
    search.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('No items match these filters.')).toBeInTheDocument()
  })

  it('shows an error with Retry when loading fails', async () => {
    search.mockRejectedValueOnce(new ApiError(0, 'Unable to reach the server. Check your connection and try again.'))
    search.mockResolvedValueOnce([bolt])
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the server.')
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('BOLT-10')).toBeInTheDocument()
  })
})
