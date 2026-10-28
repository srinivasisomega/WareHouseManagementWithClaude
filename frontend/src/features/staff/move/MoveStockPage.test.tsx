import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../api/client'
import type { InventoryItem, Item, Location, StockMovement } from '../../../api/types'
import { inventoryApi, itemsApi, locationsApi, stockApi } from '../../../api/warehouseApi'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { MoveStockPage } from './MoveStockPage'

vi.mock('../../../api/warehouseApi', () => ({
  itemsApi: { list: vi.fn() },
  locationsApi: { list: vi.fn() },
  inventoryApi: { search: vi.fn() },
  stockApi: { transfer: vi.fn() },
}))

const items: Item[] = [
  { id: 1, sku: 'BOLT-10', name: 'Bolt 10mm', description: null, unitOfMeasure: 'EA', lowStockThreshold: 5, isActive: true },
]
const locations: Location[] = [
  { id: 7, code: 'A-01', name: 'Aisle A bay 1', description: null, isActive: true },
  { id: 8, code: 'B-02', name: 'Aisle B bay 2', description: null, isActive: true },
]
const inventory: InventoryItem[] = [
  {
    itemId: 1,
    sku: 'BOLT-10',
    name: 'Bolt 10mm',
    unitOfMeasure: 'EA',
    totalQuantity: 30,
    lowStockThreshold: 5,
    isLowStock: false,
    locations: [
      { locationId: 7, locationCode: 'A-01', locationName: 'Aisle A bay 1', quantity: 25 },
      { locationId: 8, locationCode: 'B-02', locationName: 'Aisle B bay 2', quantity: 5 },
    ],
  },
]
const movement: StockMovement = {
  id: 200,
  type: 'Transfer',
  itemId: 1,
  sku: 'BOLT-10',
  itemName: 'Bolt 10mm',
  fromLocationCode: 'A-01',
  toLocationCode: 'B-02',
  quantity: 4,
  reference: null,
  performedBy: 'staff',
  createdAtUtc: '2026-10-27T10:00:00',
}

const itemSelect = () => screen.getByLabelText(/^Item/)
const fromSelect = () => screen.getByLabelText(/^From location/)
const toSelect = () => screen.getByLabelText(/^To location/)
const quantityInput = () => screen.getByLabelText(/^Quantity/)
const submit = () => screen.getByRole('button', { name: 'Move stock' })

async function renderLoaded() {
  renderWithProviders(<MoveStockPage />, { route: '/move' })
  await screen.findByRole('option', { name: 'BOLT-10 — Bolt 10mm' })
  await screen.findAllByRole('option', { name: 'A-01 — Aisle A bay 1' })
}

describe('MoveStockPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(itemsApi.list).mockResolvedValue(items)
    vi.mocked(locationsApi.list).mockResolvedValue(locations)
    vi.mocked(inventoryApi.search).mockResolvedValue(inventory)
    vi.mocked(stockApi.transfer).mockResolvedValue(movement)
  })

  it('shows required-field messages and does not call the API', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    await user.click(submit())

    expect(screen.getByText('Select an item.')).toBeInTheDocument()
    expect(screen.getByText('Select a source location.')).toBeInTheDocument()
    expect(screen.getByText('Select a destination location.')).toBeInTheDocument()
    expect(screen.getByText('Enter a whole number of 1 or more.')).toBeInTheDocument()
    expect(stockApi.transfer).not.toHaveBeenCalled()
  })

  it('requires a destination different from the source', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    await user.selectOptions(itemSelect(), '1')
    await user.selectOptions(fromSelect(), '7')
    await user.selectOptions(toSelect(), '7')
    await user.type(quantityInput(), '4')
    await user.click(submit())

    expect(screen.getByText('Choose a different destination.')).toBeInTheDocument()
    expect(stockApi.transfer).not.toHaveBeenCalled()
  })

  it('shows the quantity available at the source location', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    expect(screen.queryByText(/Available here/)).not.toBeInTheDocument()
    await user.selectOptions(itemSelect(), '1')
    await user.selectOptions(fromSelect(), '7')

    expect(await screen.findByText('Available here: 25 EA')).toBeInTheDocument()
    expect(inventoryApi.search).toHaveBeenLastCalledWith({ locationId: 7 })

    await user.selectOptions(fromSelect(), '8')
    expect(await screen.findByText('Available here: 5 EA')).toBeInTheDocument()
  })

  it('shows zero available when the item is not stocked at the source', async () => {
    vi.mocked(inventoryApi.search).mockResolvedValue([])
    const user = userEvent.setup()
    await renderLoaded()

    await user.selectOptions(itemSelect(), '1')
    await user.selectOptions(fromSelect(), '7')

    expect(await screen.findByText('Available here: 0')).toBeInTheDocument()
  })

  it('submits the transfer, shows success and resets quantity and reference', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    await user.selectOptions(itemSelect(), '1')
    await user.selectOptions(fromSelect(), '7')
    await user.selectOptions(toSelect(), '8')
    await user.type(quantityInput(), '4')
    await user.type(screen.getByLabelText(/^Reference/), 'Re-slot')
    await user.click(submit())

    expect(stockApi.transfer).toHaveBeenCalledWith({
      itemId: 1,
      fromLocationId: 7,
      toLocationId: 8,
      quantity: 4,
      reference: 'Re-slot',
    })
    expect(await screen.findByText('Moved 4 × BOLT-10 from A-01 to B-02.')).toBeInTheDocument()
    expect(quantityInput()).toHaveValue('')
    expect(screen.getByLabelText(/^Reference/)).toHaveValue('')
    expect(fromSelect()).toHaveValue('7')
  })

  it('shows the server error and preserves the input', async () => {
    vi.mocked(stockApi.transfer).mockRejectedValue(
      new ApiError(422, 'Insufficient stock: only 25 available at A-01.'),
    )
    const user = userEvent.setup()
    await renderLoaded()

    await user.selectOptions(itemSelect(), '1')
    await user.selectOptions(fromSelect(), '7')
    await user.selectOptions(toSelect(), '8')
    await user.type(quantityInput(), '99')
    await user.click(submit())

    expect(await screen.findByRole('alert')).toHaveTextContent('Insufficient stock: only 25 available at A-01.')
    expect(quantityInput()).toHaveValue('99')
    expect(itemSelect()).toHaveValue('1')
    expect(toSelect()).toHaveValue('8')
    expect(screen.queryByText(/Moved/)).not.toBeInTheDocument()
  })
})
