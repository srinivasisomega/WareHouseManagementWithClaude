import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../api/client'
import type { Item, Location, StockMovement } from '../../../api/types'
import { itemsApi, locationsApi, stockApi } from '../../../api/warehouseApi'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { ReceivePage } from './ReceivePage'

vi.mock('../../../api/warehouseApi', () => ({
  itemsApi: { list: vi.fn() },
  locationsApi: { list: vi.fn() },
  stockApi: { receive: vi.fn() },
}))

const items: Item[] = [
  { id: 1, sku: 'BOLT-10', name: 'Bolt 10mm', description: null, unitOfMeasure: 'EA', lowStockThreshold: 5, isActive: true },
  { id: 2, sku: 'NUT-10', name: 'Nut 10mm', description: null, unitOfMeasure: 'EA', lowStockThreshold: 5, isActive: true },
]
const locations: Location[] = [
  { id: 7, code: 'A-01', name: 'Aisle A bay 1', description: null, isActive: true },
  { id: 8, code: 'B-02', name: 'Aisle B bay 2', description: null, isActive: true },
]

const movement: StockMovement = {
  id: 100,
  type: 'Receipt',
  itemId: 1,
  sku: 'BOLT-10',
  itemName: 'Bolt 10mm',
  fromLocationCode: null,
  toLocationCode: 'A-01',
  quantity: 10,
  reference: 'PO-1',
  performedBy: 'staff',
  createdAtUtc: '2026-10-27T10:00:00',
}

async function renderLoaded(route = '/receive') {
  renderWithProviders(<ReceivePage />, { route })
  await screen.findByRole('option', { name: 'BOLT-10 — Bolt 10mm' })
  await screen.findByRole('option', { name: 'A-01 — Aisle A bay 1' })
}

describe('ReceivePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(itemsApi.list).mockResolvedValue(items)
    vi.mocked(locationsApi.list).mockResolvedValue(locations)
    vi.mocked(stockApi.receive).mockResolvedValue(movement)
  })

  it('shows required-field messages and does not call the API', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    await user.click(screen.getByRole('button', { name: 'Receive stock' }))

    expect(screen.getByText('Select an item.')).toBeInTheDocument()
    expect(screen.getByText('Select a location.')).toBeInTheDocument()
    expect(screen.getByText('Enter a whole number of 1 or more.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Item/)).toHaveAttribute('aria-invalid', 'true')
    expect(stockApi.receive).not.toHaveBeenCalled()
  })

  it('rejects zero and non-whole quantities', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    await user.selectOptions(screen.getByLabelText(/Item/), '1')
    await user.selectOptions(screen.getByLabelText(/Location/), '7')

    await user.type(screen.getByLabelText(/Quantity/), '0')
    await user.click(screen.getByRole('button', { name: 'Receive stock' }))
    expect(screen.getByText('Enter a whole number of 1 or more.')).toBeInTheDocument()

    await user.clear(screen.getByLabelText(/Quantity/))
    await user.type(screen.getByLabelText(/Quantity/), '2.5')
    await user.click(screen.getByRole('button', { name: 'Receive stock' }))
    expect(screen.getByText('Enter a whole number of 1 or more.')).toBeInTheDocument()
    expect(stockApi.receive).not.toHaveBeenCalled()
  })

  it('submits the receipt, shows success and resets quantity and reference', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    await user.selectOptions(screen.getByLabelText(/Item/), '1')
    await user.selectOptions(screen.getByLabelText(/Location/), '7')
    await user.type(screen.getByLabelText(/Quantity/), '10')
    await user.type(screen.getByLabelText(/Reference/), '  PO-1 ')
    await user.click(screen.getByRole('button', { name: 'Receive stock' }))

    expect(stockApi.receive).toHaveBeenCalledWith({ itemId: 1, locationId: 7, quantity: 10, reference: 'PO-1' })
    expect(await screen.findByText('Received 10 × BOLT-10 at A-01.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Quantity/)).toHaveValue('')
    expect(screen.getByLabelText(/Reference/)).toHaveValue('')
    expect(screen.getByLabelText(/Item/)).toHaveValue('1')
    expect(screen.getByLabelText(/Location/)).toHaveValue('7')
  })

  it('sends a null reference when none is entered', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    await user.selectOptions(screen.getByLabelText(/Item/), '2')
    await user.selectOptions(screen.getByLabelText(/Location/), '8')
    await user.type(screen.getByLabelText(/Quantity/), '3')
    await user.click(screen.getByRole('button', { name: 'Receive stock' }))

    expect(stockApi.receive).toHaveBeenCalledWith({ itemId: 2, locationId: 8, quantity: 3, reference: null })
  })

  it('shows the server error and field errors and preserves the input', async () => {
    vi.mocked(stockApi.receive).mockRejectedValue(
      new ApiError(422, 'Location A-01 is inactive.', { quantity: ['Quantity is too large.'] }),
    )
    const user = userEvent.setup()
    await renderLoaded()

    await user.selectOptions(screen.getByLabelText(/Item/), '1')
    await user.selectOptions(screen.getByLabelText(/Location/), '7')
    await user.type(screen.getByLabelText(/Quantity/), '10')
    await user.type(screen.getByLabelText(/Reference/), 'PO-1')
    await user.click(screen.getByRole('button', { name: 'Receive stock' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Location A-01 is inactive.')
    expect(screen.getByText('Quantity is too large.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Quantity/)).toHaveValue('10')
    expect(screen.getByLabelText(/Reference/)).toHaveValue('PO-1')
    expect(screen.queryByText(/Received/)).not.toBeInTheDocument()
  })

  it('disables submit while the request is pending', async () => {
    let resolve!: (m: StockMovement) => void
    vi.mocked(stockApi.receive).mockReturnValue(new Promise((r) => (resolve = r)))
    const user = userEvent.setup()
    await renderLoaded()

    await user.selectOptions(screen.getByLabelText(/Item/), '1')
    await user.selectOptions(screen.getByLabelText(/Location/), '7')
    await user.type(screen.getByLabelText(/Quantity/), '10')
    await user.click(screen.getByRole('button', { name: 'Receive stock' }))

    expect(screen.getByRole('button', { name: 'Receiving…' })).toBeDisabled()
    resolve(movement)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Receive stock' })).toBeEnabled())
  })

  it('pre-selects the item from the itemId query string', async () => {
    await renderLoaded('/receive?itemId=2')

    expect(screen.getByLabelText(/Item/)).toHaveValue('2')
  })

  it('shows an error when reference data fails to load', async () => {
    vi.mocked(itemsApi.list).mockRejectedValue(new ApiError(500, 'Server unavailable.'))
    renderWithProviders(<ReceivePage />, { route: '/receive' })

    expect(await screen.findByText(/Could not load items\. Server unavailable\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})
