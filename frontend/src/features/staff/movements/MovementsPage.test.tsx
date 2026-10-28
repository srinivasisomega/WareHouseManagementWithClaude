import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../api/client'
import type { Item, Location, StockMovement } from '../../../api/types'
import { itemsApi, locationsApi, stockApi } from '../../../api/warehouseApi'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { MovementsPage } from './MovementsPage'

vi.mock('../../../api/warehouseApi', () => ({
  itemsApi: { list: vi.fn() },
  locationsApi: { list: vi.fn() },
  stockApi: { movements: vi.fn() },
}))

const items: Item[] = [
  { id: 1, sku: 'BOLT-10', name: 'Bolt 10mm', description: null, unitOfMeasure: 'EA', lowStockThreshold: 5, isActive: true },
]
const locations: Location[] = [{ id: 7, code: 'A-01', name: 'Aisle A bay 1', description: null, isActive: true }]
const movements: StockMovement[] = [
  {
    id: 2,
    type: 'Transfer',
    itemId: 1,
    sku: 'BOLT-10',
    itemName: 'Bolt 10mm',
    fromLocationCode: 'A-01',
    toLocationCode: 'B-02',
    quantity: 4,
    reference: null,
    performedBy: 'staff',
    createdAtUtc: '2026-10-27T11:00:00',
  },
  {
    id: 1,
    type: 'Receipt',
    itemId: 1,
    sku: 'BOLT-10',
    itemName: 'Bolt 10mm',
    fromLocationCode: null,
    toLocationCode: 'A-01',
    quantity: 10,
    reference: 'PO-1',
    performedBy: 'admin',
    createdAtUtc: '2026-10-27T10:00:00',
  },
]

describe('MovementsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(itemsApi.list).mockResolvedValue(items)
    vi.mocked(locationsApi.list).mockResolvedValue(locations)
    vi.mocked(stockApi.movements).mockResolvedValue(movements)
  })

  it('shows a loading state, then the movement rows', async () => {
    renderWithProviders(<MovementsPage />)

    expect(screen.getByText('Loading movements…')).toBeInTheDocument()
    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(within(rows[1]).getByText('Transfer')).toBeInTheDocument()
    expect(within(rows[1]).getByText('B-02')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Receipt')).toBeInTheDocument()
    expect(within(rows[2]).getByText('PO-1')).toBeInTheDocument()
    expect(within(rows[2]).getByText('admin')).toBeInTheDocument()
    expect(within(rows[2]).getByText('10')).toBeInTheDocument()
    expect(stockApi.movements).toHaveBeenCalledWith({ itemId: undefined, locationId: undefined })
  })

  it('shows an empty state when there are no movements', async () => {
    vi.mocked(stockApi.movements).mockResolvedValue([])
    renderWithProviders(<MovementsPage />)

    expect(await screen.findByText('No stock movements match these filters.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows an error with a retry button when loading fails', async () => {
    vi.mocked(stockApi.movements).mockRejectedValueOnce(new ApiError(500, 'Server unavailable.'))
    const user = userEvent.setup()
    renderWithProviders(<MovementsPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable.')
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })

  it('reports a failed location filter load and retries it', async () => {
    vi.mocked(locationsApi.list).mockRejectedValueOnce(new ApiError(500, 'Server unavailable.'))
    const user = userEvent.setup()
    renderWithProviders(<MovementsPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load locations. Server unavailable.')
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('option', { name: 'A-01 — Aisle A bay 1' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('reloads with the selected item and location filters', async () => {
    const user = userEvent.setup()
    renderWithProviders(<MovementsPage />)
    await screen.findByRole('table')
    await screen.findByRole('option', { name: 'BOLT-10 — Bolt 10mm' })
    await screen.findByRole('option', { name: 'A-01 — Aisle A bay 1' })

    await user.selectOptions(screen.getByLabelText('Item'), '1')
    expect(stockApi.movements).toHaveBeenLastCalledWith({ itemId: 1, locationId: undefined })

    await user.selectOptions(screen.getByLabelText('Location'), '7')
    expect(stockApi.movements).toHaveBeenLastCalledWith({ itemId: 1, locationId: 7 })

    await user.selectOptions(screen.getByLabelText('Item'), '')
    expect(stockApi.movements).toHaveBeenLastCalledWith({ itemId: undefined, locationId: 7 })
  })
})
