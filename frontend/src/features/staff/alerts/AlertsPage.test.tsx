import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../api/client'
import type { StockAlert } from '../../../api/types'
import { inventoryApi } from '../../../api/warehouseApi'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { AlertsPage } from './AlertsPage'

vi.mock('../../../api/warehouseApi', () => ({
  inventoryApi: { search: vi.fn(), alerts: vi.fn() },
}))

const alerts = vi.mocked(inventoryApi.alerts)

const lowBolt: StockAlert = { itemId: 7, sku: 'BOLT-10', name: 'Hex bolt', totalQuantity: 4, lowStockThreshold: 10, shortfall: 6 }
const outNut: StockAlert = { itemId: 8, sku: 'NUT-5', name: 'Nut', totalQuantity: 0, lowStockThreshold: 5, shortfall: 5 }

function renderPage() {
  return renderWithProviders(<AlertsPage />, { role: 'Staff', route: '/alerts' })
}

describe('AlertsPage', () => {
  beforeEach(() => {
    alerts.mockReset()
  })

  it('lists alerts with shortfall, out-of-stock text and a Receive link', async () => {
    alerts.mockResolvedValue([lowBolt, outNut])
    renderPage()

    const boltRow = (await screen.findByText('BOLT-10')).closest('tr')!
    const boltCells = within(boltRow).getAllByRole('cell').map((c) => c.textContent)
    expect(boltCells.slice(0, 5)).toEqual(['BOLT-10', 'Hex bolt', '4', '10', '6'])

    const nutRow = screen.getByText('NUT-5').closest('tr')!
    expect(within(nutRow).getByText('Out of stock (0)')).toBeInTheDocument()

    expect(screen.getByRole('link', { name: 'Receive stock for BOLT-10' })).toHaveAttribute('href', '/receive?itemId=7')
    expect(screen.getByRole('link', { name: 'Receive stock for NUT-5' })).toHaveAttribute('href', '/receive?itemId=8')
    expect(screen.getByText(/items need/)).toHaveTextContent('2 items need replenishment.')
  })

  it('uses the singular summary for one alert', async () => {
    alerts.mockResolvedValue([lowBolt])
    renderPage()

    expect(await screen.findByText(/item needs/)).toHaveTextContent('1 item needs replenishment.')
  })

  it('shows the empty state when nothing is low', async () => {
    alerts.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('All items are above their low-stock thresholds.')).toBeInTheDocument()
  })

  it('shows an error and reloads on Refresh', async () => {
    alerts.mockRejectedValueOnce(new ApiError(500, 'Something went wrong. Please try again.')).mockResolvedValueOnce([lowBolt])
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(await screen.findByText('BOLT-10')).toBeInTheDocument()
    expect(alerts).toHaveBeenCalledTimes(2)
  })
})
