import { useState, type FormEvent } from 'react'
import type { InventoryItem, TransferStockRequest } from '../../../api/types'
import { inventoryApi, stockApi } from '../../../api/warehouseApi'
import { FormField } from '../../../components/FormField'
import { OptionSelect } from '../../../components/OptionSelect'
import { ErrorMessage, SuccessMessage } from '../../../components/StatusMessage'
import { useApiData } from '../../../hooks/useApiData'
import { useAsyncAction } from '../../../hooks/useAsyncAction'
import { useActiveItems, useActiveLocations } from '../../../hooks/useReferenceData'
import { itemOption, locationOption, parseWholeNumber } from '../../../utils/format'

type Errors = Partial<Record<'itemId' | 'fromLocationId' | 'toLocationId' | 'quantity', string>>

/** Quantity of an item currently held at a location, looked up from the inventory API (null until both are chosen). */
function useAvailableQuantity(itemId: number | '', locationId: number | '', refreshKey: number) {
  const ready = itemId !== '' && locationId !== ''
  const state = useApiData<InventoryItem[] | null>(
    () => (ready ? inventoryApi.search({ locationId }) : Promise.resolve(null)),
    JSON.stringify([itemId, locationId, refreshKey]),
  )
  if (!ready || state.loading || state.error || !state.data) {
    return { quantity: null, unit: undefined, loading: ready && state.loading, error: ready ? state.error : null }
  }
  const row = state.data.find((r) => r.itemId === itemId)
  const quantity = row?.locations.find((l) => l.locationId === locationId)?.quantity ?? 0
  return { quantity, unit: row?.unitOfMeasure, loading: false, error: null }
}

export function MoveStockPage() {
  const [itemId, setItemId] = useState<number | ''>('')
  const [fromLocationId, setFromLocationId] = useState<number | ''>('')
  const [toLocationId, setToLocationId] = useState<number | ''>('')
  const [quantity, setQuantity] = useState('')
  const [reference, setReference] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [transferCount, setTransferCount] = useState(0)

  const items = useActiveItems()
  const locations = useActiveLocations()
  const available = useAvailableQuantity(itemId, fromLocationId, transferCount)
  const transfer = useAsyncAction((request: TransferStockRequest) => stockApi.transfer(request))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSuccessMessage(null)
    const parsedQuantity = parseWholeNumber(quantity)
    const nextErrors: Errors = {
      itemId: itemId === '' ? 'Select an item.' : undefined,
      fromLocationId: fromLocationId === '' ? 'Select a source location.' : undefined,
      toLocationId:
        toLocationId === ''
          ? 'Select a destination location.'
          : toLocationId === fromLocationId
            ? 'Choose a different destination.'
            : undefined,
      quantity: parsedQuantity === null || parsedQuantity < 1 ? 'Enter a whole number of 1 or more.' : undefined,
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return

    const movement = await transfer.run({
      itemId: itemId as number,
      fromLocationId: fromLocationId as number,
      toLocationId: toLocationId as number,
      quantity: parsedQuantity!,
      reference: reference.trim() || null,
    })
    if (!movement) return

    setSuccessMessage(
      `Moved ${movement.quantity} × ${movement.sku} from ${movement.fromLocationCode ?? 'source'} to ${movement.toLocationCode ?? 'destination'}.`,
    )
    setQuantity('')
    setReference('')
    setTransferCount((c) => c + 1)
  }

  const fieldError = (key: keyof Errors | 'reference') =>
    (key === 'reference' ? undefined : errors[key]) ?? transfer.fieldErrors[key]?.[0]

  const locationOptions = (locations.data ?? []).map(locationOption)
  const locationPlaceholder = locations.loading ? 'Loading locations…' : 'Select a location'
  const locationsDisabled = locations.loading && !locations.data

  let availableHint: string | undefined
  if (available.error) availableHint = 'Could not check available stock.'
  else if (available.loading) availableHint = 'Checking available stock…'
  else if (available.quantity !== null)
    availableHint = `Available here: ${available.quantity}${available.unit ? ` ${available.unit}` : ''}`

  return (
    <section aria-labelledby="move-title">
      <h1 id="move-title">Move stock</h1>
      <p className="muted">Transfer stock of an item from one location to another.</p>

      {successMessage && <SuccessMessage>{successMessage}</SuccessMessage>}

      <form className="card form" onSubmit={handleSubmit} noValidate aria-labelledby="move-form-title">
        <h2 id="move-form-title" className="visually-hidden">
          Transfer details
        </h2>
        {transfer.error && <ErrorMessage message={transfer.error} />}
        {items.error && <ErrorMessage message={`Could not load items. ${items.error}`} onRetry={items.reload} />}
        {locations.error && (
          <ErrorMessage message={`Could not load locations. ${locations.error}`} onRetry={locations.reload} />
        )}
        <div className="form__grid">
          <FormField label="Item" error={fieldError('itemId')} required>
            {(p) => (
              <OptionSelect
                {...p}
                value={itemId}
                placeholder={items.loading ? 'Loading items…' : 'Select an item'}
                options={(items.data ?? []).map(itemOption)}
                disabled={items.loading && !items.data}
                onChange={setItemId}
              />
            )}
          </FormField>
          <FormField label="From location" error={fieldError('fromLocationId')} hint={availableHint} required>
            {(p) => (
              <OptionSelect
                {...p}
                value={fromLocationId}
                placeholder={locationPlaceholder}
                options={locationOptions}
                disabled={locationsDisabled}
                onChange={setFromLocationId}
              />
            )}
          </FormField>
          <FormField label="To location" error={fieldError('toLocationId')} required>
            {(p) => (
              <OptionSelect
                {...p}
                value={toLocationId}
                placeholder={locationPlaceholder}
                options={locationOptions}
                disabled={locationsDisabled}
                onChange={setToLocationId}
              />
            )}
          </FormField>
          <FormField label="Quantity" error={fieldError('quantity')} required>
            {(p) => (
              <input {...p} inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            )}
          </FormField>
          <FormField label="Reference" error={fieldError('reference')} hint="Optional, e.g. reason or task number">
            {(p) => <input {...p} value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} />}
          </FormField>
        </div>
        <div className="form__actions">
          <button type="submit" className="button" disabled={transfer.pending}>
            {transfer.pending ? 'Moving…' : 'Move stock'}
          </button>
        </div>
      </form>
    </section>
  )
}
