import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ApiError } from '../../../api/client'
import type { Item, OrderDetail } from '../../../api/types'
import { itemsApi, ordersApi } from '../../../api/warehouseApi'
import { CreateOrderPage } from './CreateOrderPage'

vi.mock('../../../api/warehouseApi', () => ({
  itemsApi: { list: vi.fn() },
  ordersApi: { create: vi.fn() },
}))

const listItems = vi.mocked(itemsApi.list)
const create = vi.mocked(ordersApi.create)

const items: Item[] = [
  { id: 1, sku: 'BOLT-10', name: 'Bolt', description: null, unitOfMeasure: 'EA', lowStockThreshold: 0, isActive: true },
  { id: 2, sku: 'NUT-10', name: 'Nut', description: null, unitOfMeasure: 'EA', lowStockThreshold: 0, isActive: true },
]

const createdOrder: OrderDetail = {
  id: 42,
  orderNumber: 'SO-0042',
  customerName: 'Acme Ltd',
  status: 'Open',
  packageCount: null,
  carrier: null,
  trackingNumber: null,
  createdBy: 'staff',
  createdAtUtc: '2026-10-01T09:00:00',
  packedAtUtc: null,
  dispatchedAtUtc: null,
  lines: [],
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/orders/new']}>
      <Routes>
        <Route path="/orders/new" element={<CreateOrderPage />} />
        <Route path="/orders/:id" element={<p>Order detail route</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function waitForItems() {
  await screen.findByRole('option', { name: 'BOLT-10 — Bolt' })
}

describe('CreateOrderPage', () => {
  beforeEach(() => {
    listItems.mockReset().mockResolvedValue(items)
    create.mockReset()
  })

  it('requires a customer name and an item, without calling the API', async () => {
    renderPage()
    await waitForItems()

    await userEvent.click(screen.getByRole('button', { name: 'Create order' }))

    expect(screen.getByText('Customer name is required.')).toBeInTheDocument()
    expect(screen.getByText('Select an item.')).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it('rejects quantities that are not whole numbers of at least 1', async () => {
    renderPage()
    await waitForItems()

    await userEvent.type(screen.getByLabelText(/Customer name/), 'Acme Ltd')
    await userEvent.selectOptions(screen.getByLabelText(/Item \(line 1\)/), '1')
    const quantity = screen.getByLabelText(/Quantity \(line 1\)/)
    await userEvent.clear(quantity)
    await userEvent.type(quantity, '0')
    await userEvent.click(screen.getByRole('button', { name: 'Create order' }))

    expect(screen.getByText('Enter a whole number of 1 or more.')).toBeInTheDocument()
    expect(quantity).toHaveAttribute('aria-invalid', 'true')
    expect(create).not.toHaveBeenCalled()
  })

  it('flags duplicate items across lines', async () => {
    renderPage()
    await waitForItems()

    await userEvent.type(screen.getByLabelText(/Customer name/), 'Acme Ltd')
    await userEvent.selectOptions(screen.getByLabelText(/Item \(line 1\)/), '1')
    await userEvent.click(screen.getByRole('button', { name: 'Add line' }))
    await userEvent.selectOptions(screen.getByLabelText(/Item \(line 2\)/), '1')
    await userEvent.click(screen.getByRole('button', { name: 'Create order' }))

    expect(screen.getByText(/already on the order/)).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it('adds and removes lines, keeping at least one line', async () => {
    renderPage()
    await waitForItems()

    expect(screen.getByRole('button', { name: 'Remove line 1' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Add line' }))
    expect(screen.getByLabelText(/Item \(line 2\)/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Remove line 2' }))
    expect(screen.queryByLabelText(/Item \(line 2\)/)).not.toBeInTheDocument()
  })

  it('creates the order with trimmed values and navigates to its detail page', async () => {
    create.mockResolvedValue(createdOrder)
    renderPage()
    await waitForItems()

    await userEvent.type(screen.getByLabelText(/Customer name/), '  Acme Ltd  ')
    await userEvent.selectOptions(screen.getByLabelText(/Item \(line 1\)/), '1')
    await userEvent.clear(screen.getByLabelText(/Quantity \(line 1\)/))
    await userEvent.type(screen.getByLabelText(/Quantity \(line 1\)/), '5')
    await userEvent.click(screen.getByRole('button', { name: 'Add line' }))
    await userEvent.selectOptions(screen.getByLabelText(/Item \(line 2\)/), '2')
    await userEvent.click(screen.getByRole('button', { name: 'Create order' }))

    expect(await screen.findByText('Order detail route')).toBeInTheDocument()
    expect(create).toHaveBeenCalledWith({
      customerName: 'Acme Ltd',
      lines: [
        { itemId: 1, quantity: 5 },
        { itemId: 2, quantity: 1 },
      ],
    })
  })

  it('shows server errors and preserves the input', async () => {
    create.mockRejectedValue(
      new ApiError(422, 'These items do not exist or are inactive: 1.', { 'lines[0].quantity': ['Too many.'] }),
    )
    renderPage()
    await waitForItems()

    await userEvent.type(screen.getByLabelText(/Customer name/), 'Acme Ltd')
    await userEvent.selectOptions(screen.getByLabelText(/Item \(line 1\)/), '1')
    await userEvent.click(screen.getByRole('button', { name: 'Create order' }))

    expect(await screen.findByText('These items do not exist or are inactive: 1.')).toBeInTheDocument()
    expect(screen.getByText('Too many.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Customer name/)).toHaveValue('Acme Ltd')
    expect(screen.getByLabelText(/Item \(line 1\)/)).toHaveValue('1')
    expect(screen.getByRole('button', { name: 'Create order' })).toBeEnabled()
    expect(screen.queryByText('Order detail route')).not.toBeInTheDocument()
  })

  it('disables submit while the request is pending', async () => {
    let resolve: (order: OrderDetail) => void = () => {}
    create.mockReturnValue(new Promise<OrderDetail>((r) => (resolve = r)))
    renderPage()
    await waitForItems()

    await userEvent.type(screen.getByLabelText(/Customer name/), 'Acme Ltd')
    await userEvent.selectOptions(screen.getByLabelText(/Item \(line 1\)/), '1')
    await userEvent.click(screen.getByRole('button', { name: 'Create order' }))

    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled()
    resolve(createdOrder)
    expect(await screen.findByText('Order detail route')).toBeInTheDocument()
  })
})
