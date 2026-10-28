import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../api/client'
import type { Item } from '../../../api/types'
import { itemsApi } from '../../../api/warehouseApi'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { ItemsPage } from './ItemsPage'

vi.mock('../../../api/warehouseApi', () => ({
  itemsApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), updateThreshold: vi.fn() },
}))

const list = vi.mocked(itemsApi.list)
const create = vi.mocked(itemsApi.create)

const bolt: Item = {
  id: 1,
  sku: 'BOLT-10',
  name: 'Hex bolt 10mm',
  description: null,
  unitOfMeasure: 'EA',
  lowStockThreshold: 25,
  isActive: true,
}

function renderPage() {
  return renderWithProviders(<ItemsPage />, { role: 'Admin', route: '/admin/items' })
}

const field = (label: RegExp) => screen.getByLabelText(label)

describe('ItemsPage', () => {
  beforeEach(() => {
    list.mockReset()
    create.mockReset()
  })

  it('shows a loading state and then the item rows', async () => {
    list.mockResolvedValue([bolt])
    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent('Loading items…')

    const row = (await screen.findByText('BOLT-10')).closest('tr')!
    expect(within(row).getByText('Hex bolt 10mm')).toBeInTheDocument()
    expect(within(row).getByText('25')).toBeInTheDocument()
    expect(within(row).getByText('Active')).toBeInTheDocument()
    expect(list).toHaveBeenCalledWith({ search: undefined, includeInactive: false })
  })

  it('shows the empty state when there are no items', async () => {
    list.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('No items found. Add an item or change the search.')).toBeInTheDocument()
  })

  it('shows an error with Retry that calls the API again', async () => {
    list.mockRejectedValueOnce(new ApiError(500, 'Something went wrong. Please try again.')).mockResolvedValueOnce([bolt])
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('BOLT-10')).toBeInTheDocument()
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('debounces the search input before calling the API with the term', async () => {
    list.mockResolvedValue([bolt])
    renderPage()
    await screen.findByText('BOLT-10')

    await userEvent.type(screen.getByRole('searchbox'), 'bolt')

    await waitFor(() => expect(list).toHaveBeenLastCalledWith({ search: 'bolt', includeInactive: false }))
    // Intermediate keystrokes must not each trigger a request.
    expect(list).not.toHaveBeenCalledWith({ search: 'b', includeInactive: false })
    expect(list).not.toHaveBeenCalledWith({ search: 'bo', includeInactive: false })
    expect(list).not.toHaveBeenCalledWith({ search: 'bol', includeInactive: false })
  })

  it('reloads including inactive items when "Show inactive" is checked', async () => {
    list.mockResolvedValue([bolt])
    renderPage()
    await screen.findByText('BOLT-10')

    await userEvent.click(screen.getByRole('checkbox', { name: 'Show inactive' }))

    await waitFor(() => expect(list).toHaveBeenLastCalledWith({ search: undefined, includeInactive: true }))
  })

  describe('Add item form', () => {
    async function openForm() {
      list.mockResolvedValue([bolt])
      renderPage()
      await screen.findByText('BOLT-10')
      await userEvent.click(screen.getByRole('button', { name: 'Add item' }))
      expect(screen.getByRole('heading', { name: 'New item' })).toBeInTheDocument()
    }

    it('shows validation messages for missing SKU and name and does not call the API', async () => {
      await openForm()

      await userEvent.click(screen.getByRole('button', { name: 'Save item' }))

      expect(screen.getByText('SKU is required.')).toBeInTheDocument()
      expect(screen.getByText('Name is required.')).toBeInTheDocument()
      expect(field(/^SKU/)).toHaveAttribute('aria-invalid', 'true')
      expect(create).not.toHaveBeenCalled()
    })

    it('rejects an invalid SKU format and an invalid threshold without calling the API', async () => {
      await openForm()

      await userEvent.type(field(/^SKU/), 'BAD SKU!')
      await userEvent.type(field(/^Name/), 'Widget')
      await userEvent.clear(field(/^Low-stock threshold/))
      await userEvent.type(field(/^Low-stock threshold/), '-3')
      await userEvent.click(screen.getByRole('button', { name: 'Save item' }))

      expect(screen.getByText("SKU may contain only letters, digits, '.', '_' and '-'.")).toBeInTheDocument()
      expect(screen.getByText('Enter a whole number of 0 or more.')).toBeInTheDocument()
      expect(screen.queryByText('Name is required.')).not.toBeInTheDocument()
      expect(create).not.toHaveBeenCalled()
    })

    it('creates the item with a trimmed payload and shows a success message', async () => {
      await openForm()
      create.mockResolvedValue({ ...bolt, id: 2, sku: 'NUT-5', name: 'Nut 5mm', lowStockThreshold: 10 })

      await userEvent.type(field(/^SKU/), '  NUT-5  ')
      await userEvent.type(field(/^Name/), '  Nut 5mm ')
      await userEvent.clear(field(/^Low-stock threshold/))
      await userEvent.type(field(/^Low-stock threshold/), '10')
      await userEvent.type(field(/^Description/), '   ')
      await userEvent.click(screen.getByRole('button', { name: 'Save item' }))

      expect(await screen.findByText('Item NUT-5 saved.')).toBeInTheDocument()
      expect(create).toHaveBeenCalledWith({
        sku: 'NUT-5',
        name: 'Nut 5mm',
        description: null,
        unitOfMeasure: 'EA',
        lowStockThreshold: 10,
        isActive: true,
      })
      expect(screen.queryByRole('heading', { name: 'New item' })).not.toBeInTheDocument()
      // The list is reloaded after a save.
      await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    })

    it('shows a 409 conflict message and keeps the entered values', async () => {
      await openForm()
      create.mockRejectedValue(new ApiError(409, "An item with SKU 'BOLT-10' already exists."))

      await userEvent.type(field(/^SKU/), 'BOLT-10')
      await userEvent.type(field(/^Name/), 'Duplicate bolt')
      await userEvent.click(screen.getByRole('button', { name: 'Save item' }))

      expect(await screen.findByRole('alert')).toHaveTextContent("An item with SKU 'BOLT-10' already exists.")
      expect(field(/^SKU/)).toHaveValue('BOLT-10')
      expect(field(/^Name/)).toHaveValue('Duplicate bolt')
      expect(screen.getByRole('heading', { name: 'New item' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Save item' })).toBeEnabled()
    })

    it('shows server field errors under the matching field', async () => {
      await openForm()
      create.mockRejectedValue(
        new ApiError(400, 'Please correct the highlighted fields.', { name: ['Name must be at most 200 characters.'] }),
      )

      await userEvent.type(field(/^SKU/), 'NUT-5')
      await userEvent.type(field(/^Name/), 'Nut')
      await userEvent.click(screen.getByRole('button', { name: 'Save item' }))

      expect(await screen.findByText('Name must be at most 200 characters.')).toBeInTheDocument()
      expect(field(/^Name/)).toHaveAttribute('aria-invalid', 'true')
      expect(field(/^Name/)).toHaveAccessibleDescription('Name must be at most 200 characters.')
      expect(screen.getByRole('alert')).toHaveTextContent('Please correct the highlighted fields.')
    })
  })
})
