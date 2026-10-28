import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../api/client'
import type { InventoryItem, Item } from '../../../api/types'
import { inventoryApi, itemsApi } from '../../../api/warehouseApi'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { ThresholdsPage } from './ThresholdsPage'

vi.mock('../../../api/warehouseApi', () => ({
  inventoryApi: { search: vi.fn(), alerts: vi.fn() },
  itemsApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), updateThreshold: vi.fn() },
}))

const search = vi.mocked(inventoryApi.search)
const updateThreshold = vi.mocked(itemsApi.updateThreshold)

const lowRow: InventoryItem = {
  itemId: 1,
  sku: 'BOLT-10',
  name: 'Hex bolt',
  unitOfMeasure: 'EA',
  totalQuantity: 4,
  lowStockThreshold: 10,
  isLowStock: true,
  locations: [],
}
const okRow: InventoryItem = { ...lowRow, itemId: 2, sku: 'NUT-5', name: 'Nut', totalQuantity: 100, isLowStock: false }

function renderPage() {
  return renderWithProviders(<ThresholdsPage />, { role: 'Admin', route: '/admin/thresholds' })
}

describe('ThresholdsPage', () => {
  beforeEach(() => {
    search.mockReset()
    updateThreshold.mockReset()
  })

  it('shows a text low-stock badge for low items and "In stock" otherwise', async () => {
    search.mockResolvedValue([lowRow, okRow])
    renderPage()

    const lowTr = (await screen.findByText('BOLT-10')).closest('tr')!
    expect(within(lowTr).getByText(/Low stock/)).toBeInTheDocument()
    const okTr = screen.getByText('NUT-5').closest('tr')!
    expect(within(okTr).getByText('In stock')).toBeInTheDocument()
    expect(within(okTr).queryByText(/Low stock/)).not.toBeInTheDocument()
  })

  it('shows the empty state when no items match', async () => {
    search.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('No active items match.')).toBeInTheDocument()
  })

  it('keeps Save disabled until the threshold changes', async () => {
    search.mockResolvedValue([lowRow])
    renderPage()

    const save = await screen.findByRole('button', { name: /threshold for BOLT-10$/ })
    expect(save).toBeDisabled()
  })

  it('shows a validation message for an invalid threshold and does not call the API', async () => {
    search.mockResolvedValue([lowRow])
    renderPage()

    const input = await screen.findByLabelText('Threshold for BOLT-10')
    await userEvent.clear(input)
    await userEvent.type(input, '-1')
    await userEvent.click(screen.getByRole('button', { name: /threshold for BOLT-10$/ }))

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a whole number of 0 or more.')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(updateThreshold).not.toHaveBeenCalled()
  })

  it('saves the new threshold with the item id and reloads the list', async () => {
    search.mockResolvedValueOnce([lowRow]).mockResolvedValueOnce([{ ...lowRow, lowStockThreshold: 3, isLowStock: false }])
    updateThreshold.mockResolvedValue({ id: 1, lowStockThreshold: 3 } as Item)
    renderPage()

    const input = await screen.findByLabelText('Threshold for BOLT-10')
    await userEvent.clear(input)
    await userEvent.type(input, '3')
    await userEvent.click(screen.getByRole('button', { name: /threshold for BOLT-10$/ }))

    expect(updateThreshold).toHaveBeenCalledWith(1, 3)
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2))
    const row = (await screen.findByText('In stock')).closest('tr')!
    expect(within(row).getByLabelText('Threshold for BOLT-10')).toHaveValue('3')
  })

  it('shows the server error when saving fails', async () => {
    search.mockResolvedValue([lowRow])
    updateThreshold.mockRejectedValue(new ApiError(404, 'The requested record was not found.'))
    renderPage()

    const input = await screen.findByLabelText('Threshold for BOLT-10')
    await userEvent.clear(input)
    await userEvent.type(input, '5')
    await userEvent.click(screen.getByRole('button', { name: /threshold for BOLT-10$/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The requested record was not found.')
    expect(input).toHaveValue('5')
    expect(search).toHaveBeenCalledTimes(1)
  })
})
