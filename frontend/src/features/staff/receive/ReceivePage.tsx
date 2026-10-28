import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ReceiveStockRequest } from '../../../api/types'
import { stockApi } from '../../../api/warehouseApi'
import { FormField } from '../../../components/FormField'
import { OptionSelect } from '../../../components/OptionSelect'
import { ErrorMessage, SuccessMessage } from '../../../components/StatusMessage'
import { useAsyncAction } from '../../../hooks/useAsyncAction'
import { useActiveItems, useActiveLocations } from '../../../hooks/useReferenceData'
import { itemOption, locationOption, parseWholeNumber } from '../../../utils/format'

type Errors = Partial<Record<'itemId' | 'locationId' | 'quantity', string>>

function initialItemId(raw: string | null): number | '' {
  const id = raw === null ? null : parseWholeNumber(raw)
  return id && id > 0 ? id : ''
}

export function ReceivePage() {
  const [searchParams] = useSearchParams()
  const [itemId, setItemId] = useState<number | ''>(() => initialItemId(searchParams.get('itemId')))
  const [locationId, setLocationId] = useState<number | ''>('')
  const [quantity, setQuantity] = useState('')
  const [reference, setReference] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const items = useActiveItems()
  const locations = useActiveLocations()
  const receive = useAsyncAction((request: ReceiveStockRequest) => stockApi.receive(request))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSuccessMessage(null)
    const parsedQuantity = parseWholeNumber(quantity)
    const nextErrors: Errors = {
      itemId: itemId === '' ? 'Select an item.' : undefined,
      locationId: locationId === '' ? 'Select a location.' : undefined,
      quantity: parsedQuantity === null || parsedQuantity < 1 ? 'Enter a whole number of 1 or more.' : undefined,
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return

    const movement = await receive.run({
      itemId: itemId as number,
      locationId: locationId as number,
      quantity: parsedQuantity!,
      reference: reference.trim() || null,
    })
    if (!movement) return

    setSuccessMessage(`Received ${movement.quantity} × ${movement.sku} at ${movement.toLocationCode ?? 'location'}.`)
    setQuantity('')
    setReference('')
  }

  const fieldError = (key: keyof Errors | 'reference') =>
    (key === 'reference' ? undefined : errors[key]) ?? receive.fieldErrors[key]?.[0]

  return (
    <section aria-labelledby="receive-title">
      <h1 id="receive-title">Receive stock</h1>
      <p className="muted">Record goods arriving from a supplier into a storage location.</p>

      {successMessage && <SuccessMessage>{successMessage}</SuccessMessage>}

      <form className="card form" onSubmit={handleSubmit} noValidate aria-labelledby="receive-form-title">
        <h2 id="receive-form-title" className="visually-hidden">
          Receipt details
        </h2>
        {receive.error && <ErrorMessage message={receive.error} />}
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
          <FormField label="Location" error={fieldError('locationId')} required>
            {(p) => (
              <OptionSelect
                {...p}
                value={locationId}
                placeholder={locations.loading ? 'Loading locations…' : 'Select a location'}
                options={(locations.data ?? []).map(locationOption)}
                disabled={locations.loading && !locations.data}
                onChange={setLocationId}
              />
            )}
          </FormField>
          <FormField label="Quantity" error={fieldError('quantity')} required>
            {(p) => (
              <input {...p} inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            )}
          </FormField>
          <FormField label="Reference" error={fieldError('reference')} hint="Optional, e.g. PO or delivery note number">
            {(p) => <input {...p} value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} />}
          </FormField>
        </div>
        <div className="form__actions">
          <button type="submit" className="button" disabled={receive.pending}>
            {receive.pending ? 'Receiving…' : 'Receive stock'}
          </button>
        </div>
      </form>
    </section>
  )
}
