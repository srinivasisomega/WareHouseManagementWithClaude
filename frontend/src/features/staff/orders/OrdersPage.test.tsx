import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../api/client'
import type { OrderSummary } from '../../../api/types'
import { ordersApi } from '../../../api/warehouseApi'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { OrdersPage } from './OrdersPage'

vi.mock('../../../api/warehouseApi', () => ({
  ordersApi: { list: vi.fn() },
}))

const list = vi.mocked(ordersApi.list)

const orders: OrderSummary[] = [
  {
    id: 5,
    orderNumber: 'SO-0005',
    customerName: 'Acme Ltd',
    status: 'Picking',
    lineCount: 2,
    totalUnits: 12,
    createdAtUtc: '2026-10-01T09:00:00',
  },
  {
    id: 6,
    orderNumber: 'SO-0006',
    customerName: 'Globex',
    status: 'Dispatched',
    lineCount: 1,
    totalUnits: 3,
    createdAtUtc: '2026-10-02T10:00:00',
  },
]

describe('OrdersPage', () => {
  beforeEach(() => {
    list.mockReset()
  })

  it('shows a loading state, then the orders with links and status text', async () => {
    list.mockResolvedValue(orders)
    renderWithProviders(<OrdersPage />, { route: '/orders' })

    expect(screen.getByText('Loading orders…')).toBeInTheDocument()

    const link = await screen.findByRole('link', { name: 'SO-0005' })
    expect(link).toHaveAttribute('href', '/orders/5')
    const row = link.closest('tr')!
    expect(within(row).getByText('Acme Ltd')).toBeInTheDocument()
    expect(within(row).getByText('Picking')).toBeInTheDocument()
    expect(within(row).getByText('2')).toBeInTheDocument()
    expect(within(row).getByText('12')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'SO-0006' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'New order' })).toHaveAttribute('href', '/orders/new')
    expect(list).toHaveBeenCalledWith(undefined)
  })

  it('shows an empty state when there are no orders', async () => {
    list.mockResolvedValue([])
    renderWithProviders(<OrdersPage />, { route: '/orders' })

    expect(await screen.findByText(/No orders yet/)).toBeInTheDocument()
  })

  it('shows an error with a retry button when loading fails', async () => {
    list.mockRejectedValueOnce(new ApiError(500, 'Server unavailable.')).mockResolvedValueOnce(orders)
    renderWithProviders(<OrdersPage />, { route: '/orders' })

    expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable.')
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('link', { name: 'SO-0005' })).toBeInTheDocument()
  })

  it('filters by status', async () => {
    list.mockResolvedValue(orders)
    renderWithProviders(<OrdersPage />, { route: '/orders' })
    await screen.findByRole('link', { name: 'SO-0005' })

    list.mockResolvedValue([])
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'Packed')

    await waitFor(() => expect(list).toHaveBeenLastCalledWith('Packed'))
    expect(await screen.findByText('No Packed orders.')).toBeInTheDocument()
  })
})
