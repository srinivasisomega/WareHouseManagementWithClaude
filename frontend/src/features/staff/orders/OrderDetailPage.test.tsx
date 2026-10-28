import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../api/client'
import type { OrderDetail, OrderLine } from '../../../api/types'
import { ordersApi } from '../../../api/warehouseApi'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { OrderDetailPage } from './OrderDetailPage'

vi.mock('../../../api/warehouseApi', () => ({
  ordersApi: { get: vi.fn(), pick: vi.fn(), pack: vi.fn(), dispatch: vi.fn() },
}))

const get = vi.mocked(ordersApi.get)
const pick = vi.mocked(ordersApi.pick)
const pack = vi.mocked(ordersApi.pack)
const dispatch = vi.mocked(ordersApi.dispatch)

function line(overrides: Partial<OrderLine> = {}): OrderLine {
  return {
    id: 11,
    itemId: 1,
    sku: 'BOLT-10',
    itemName: 'Bolt',
    quantityOrdered: 10,
    quantityPicked: 0,
    availableLocations: [
      { locationId: 3, locationCode: 'A-01', locationName: 'Aisle 1', quantity: 4 },
      { locationId: 4, locationCode: 'B-02', locationName: 'Aisle 2', quantity: 50 },
    ],
    ...overrides,
  }
}

function order(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: 5,
    orderNumber: 'SO-0005',
    customerName: 'Acme Ltd',
    status: 'Open',
    packageCount: null,
    carrier: null,
    trackingNumber: null,
    createdBy: 'staff',
    createdAtUtc: '2026-10-01T09:00:00',
    packedAtUtc: null,
    dispatchedAtUtc: null,
    lines: [line()],
    ...overrides,
  }
}

const renderPage = (route = '/orders/5') => renderWithProviders(<OrderDetailPage />, { route, path: '/orders/:id' })

describe('OrderDetailPage', () => {
  beforeEach(() => {
    get.mockReset()
    pick.mockReset()
    pack.mockReset()
    dispatch.mockReset()
  })

  it('loads the order by id and shows its header and lines', async () => {
    get.mockResolvedValue(order({ lines: [line({ quantityPicked: 3 })], status: 'Picking' }))
    renderPage()

    expect(screen.getByText('Loading order…')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Order SO-0005' })).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith(5)

    const details = screen.getByRole('group', { name: 'Order details' })
    expect(within(details).getByText('Acme Ltd')).toBeInTheDocument()
    expect(within(details).getByText('Picking')).toBeInTheDocument()
    expect(within(details).getByText(/by staff/)).toBeInTheDocument()

    const row = screen.getByRole('cell', { name: 'BOLT-10' }).closest('tr')!
    const cells = within(row).getAllByRole('cell')
    expect(cells.slice(0, 5).map((c) => c.textContent)).toEqual(['BOLT-10', 'Bolt', '10', '3', '7'])
  })

  it('defaults the pick quantity, submits the pick payload and updates the order', async () => {
    get.mockResolvedValue(order())
    pick.mockResolvedValue(
      order({ status: 'Picking', lines: [line({ quantityPicked: 4, availableLocations: [line().availableLocations[1]] })] }),
    )
    renderPage()

    const location = await screen.findByLabelText('Pick location for BOLT-10')
    expect(within(location).getByRole('option', { name: 'A-01 (4 available)' })).toBeInTheDocument()
    expect(location).toHaveValue('3')
    const quantity = screen.getByLabelText('Pick quantity for BOLT-10')
    expect(quantity).toHaveValue('4')

    await userEvent.selectOptions(location, '4')
    expect(quantity).toHaveValue('10')
    await userEvent.selectOptions(location, '3')
    expect(quantity).toHaveValue('4')

    await userEvent.click(screen.getByRole('button', { name: 'Pick BOLT-10' }))

    expect(pick).toHaveBeenCalledWith(5, { orderLineId: 11, locationId: 3, quantity: 4 })
    expect(await screen.findByText('Picked 4 of BOLT-10.')).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Order details' })).getByText('Picking')).toBeInTheDocument()
    expect(screen.getByLabelText('Pick quantity for BOLT-10')).toHaveValue('6')
  })

  it('validates the pick quantity before calling the API', async () => {
    get.mockResolvedValue(order())
    renderPage()

    const quantity = await screen.findByLabelText('Pick quantity for BOLT-10')
    await userEvent.clear(quantity)
    await userEvent.type(quantity, 'abc')
    await userEvent.click(screen.getByRole('button', { name: 'Pick BOLT-10' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a whole number of 1 or more.')
    expect(pick).not.toHaveBeenCalled()
  })

  it('shows the server message when a pick is rejected', async () => {
    get.mockResolvedValue(order())
    pick.mockRejectedValue(new ApiError(422, 'Cannot pick 4; only 2 remaining on this line.'))
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Pick BOLT-10' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot pick 4; only 2 remaining on this line.')
    expect(screen.getByLabelText('Pick quantity for BOLT-10')).toHaveValue('4')
  })

  it('shows when there is no stock available to pick', async () => {
    get.mockResolvedValue(order({ lines: [line({ availableLocations: [] })] }))
    renderPage()

    expect(await screen.findByText('No stock available to pick')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pick/ })).not.toBeInTheDocument()
  })

  it('shows the pack form only when the order is Picked and packs it', async () => {
    get.mockResolvedValue(order({ status: 'Picked', lines: [line({ quantityPicked: 10 })] }))
    pack.mockResolvedValue(
      order({ status: 'Packed', packageCount: 2, packedAtUtc: '2026-10-02T09:00:00', lines: [line({ quantityPicked: 10 })] }),
    )
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Pack order' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Pick/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Dispatch order' })).not.toBeInTheDocument()

    const count = screen.getByLabelText(/Package count/)
    await userEvent.clear(count)
    await userEvent.type(count, '0')
    await userEvent.click(screen.getByRole('button', { name: 'Mark as packed' }))
    expect(screen.getByText('Enter a whole number of 1 or more.')).toBeInTheDocument()
    expect(pack).not.toHaveBeenCalled()

    await userEvent.clear(count)
    await userEvent.type(count, '2')
    await userEvent.click(screen.getByRole('button', { name: 'Mark as packed' }))

    expect(pack).toHaveBeenCalledWith(5, 2)
    expect(await screen.findByText('Order SO-0005 packed in 2 packages.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pack order' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Dispatch order' })).toBeInTheDocument()
  })

  it('does not offer pack or dispatch while the order is still being picked', async () => {
    get.mockResolvedValue(order({ status: 'Picking' }))
    renderPage()

    await screen.findByRole('heading', { name: 'Order SO-0005' })
    expect(screen.queryByRole('heading', { name: 'Pack order' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Dispatch order' })).not.toBeInTheDocument()
  })

  it('shows the dispatch form only when Packed, validates the carrier and dispatches', async () => {
    const packed = order({ status: 'Packed', packageCount: 2, packedAtUtc: '2026-10-02T09:00:00', lines: [line({ quantityPicked: 10 })] })
    get.mockResolvedValue(packed)
    dispatch.mockResolvedValue({ ...packed, status: 'Dispatched', carrier: 'DHL', trackingNumber: null, dispatchedAtUtc: '2026-10-03T09:00:00' })
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Dispatch order' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pack order' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Dispatch order' }))
    expect(screen.getByText('Carrier is required.')).toBeInTheDocument()
    expect(dispatch).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText(/Carrier/), ' DHL ')
    await userEvent.click(screen.getByRole('button', { name: 'Dispatch order' }))

    expect(dispatch).toHaveBeenCalledWith(5, { carrier: 'DHL', trackingNumber: null })
    expect(await screen.findByText('Order SO-0005 dispatched via DHL.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Dispatch order' })).not.toBeInTheDocument()
    expect(screen.getByText('This order has been dispatched and is read-only.')).toBeInTheDocument()
  })

  it('shows a 422 message from the server when dispatch is rejected', async () => {
    get.mockResolvedValue(order({ status: 'Packed', packageCount: 1, packedAtUtc: '2026-10-02T09:00:00' }))
    dispatch.mockRejectedValue(new ApiError(422, 'Order SO-0005 must be packed before dispatch (current status: Picked).'))
    renderPage()

    await userEvent.type(await screen.findByLabelText(/Carrier/), 'DHL')
    await userEvent.type(screen.getByLabelText(/Tracking number/), 'TRK-1')
    await userEvent.click(screen.getByRole('button', { name: 'Dispatch order' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('must be packed before dispatch')
    expect(dispatch).toHaveBeenCalledWith(5, { carrier: 'DHL', trackingNumber: 'TRK-1' })
    expect(screen.getByLabelText(/Carrier/)).toHaveValue('DHL')
  })

  it('shows a read-only summary for dispatched orders', async () => {
    get.mockResolvedValue(
      order({
        status: 'Dispatched',
        packageCount: 3,
        carrier: 'UPS',
        trackingNumber: '1Z999',
        packedAtUtc: '2026-10-02T09:00:00',
        dispatchedAtUtc: '2026-10-03T09:00:00',
        lines: [line({ quantityPicked: 10 })],
      }),
    )
    renderPage()

    expect(await screen.findByText('UPS')).toBeInTheDocument()
    expect(screen.getByText('1Z999')).toBeInTheDocument()
    expect(screen.getByText(/3 packages/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pick|packed|Dispatch/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('shows a not-found error from the API', async () => {
    get.mockRejectedValue(new ApiError(404, 'Order 999 was not found.'))
    renderPage('/orders/999')

    expect(await screen.findByRole('alert')).toHaveTextContent('Order 999 was not found.')
  })

  it('treats a non-numeric id as not found without calling the API', async () => {
    renderPage('/orders/abc')

    expect(await screen.findByRole('alert')).toHaveTextContent('The requested order was not found.')
    expect(get).not.toHaveBeenCalled()
  })
})
