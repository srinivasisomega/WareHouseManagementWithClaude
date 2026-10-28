import { useState, type FormEvent } from 'react'
import type { OrderDetail, OrderLine } from '../../../api/types'
import { ordersApi } from '../../../api/warehouseApi'
import { OptionSelect } from '../../../components/OptionSelect'
import { useAsyncAction } from '../../../hooks/useAsyncAction'
import { parseWholeNumber } from '../../../utils/format'

interface PickLineFormProps {
  orderId: number
  line: OrderLine
  onPicked: (order: OrderDetail, message: string) => void
}

interface PickRequest {
  orderLineId: number
  locationId: number
  quantity: number
}

const defaultQuantity = (remaining: number, available: number | undefined) =>
  String(Math.max(0, Math.min(remaining, available ?? remaining)))

/** Picks stock for one order line from one of the locations that hold the item. */
export function PickLineForm({ orderId, line, onPicked }: PickLineFormProps) {
  const remaining = line.quantityOrdered - line.quantityPicked
  const firstLocation = line.availableLocations[0]
  const [locationId, setLocationId] = useState<number | ''>(firstLocation?.locationId ?? '')
  const [quantity, setQuantity] = useState(defaultQuantity(remaining, firstLocation?.quantity))
  const [localError, setLocalError] = useState<{ field: 'locationId' | 'quantity'; message: string } | null>(null)
  const pick = useAsyncAction((request: PickRequest) => ordersApi.pick(orderId, request))

  if (line.availableLocations.length === 0) {
    return <span className="muted">No stock available to pick</span>
  }

  const baseId = `pick-${line.id}`
  const errorId = `${baseId}-error`
  const locationError = localError ? localError.field === 'locationId' : !pick.fieldErrors.quantity && Boolean(pick.fieldErrors.locationId)
  const error = localError?.message ?? pick.fieldErrors.quantity?.[0] ?? pick.fieldErrors.locationId?.[0] ?? pick.error
  // The message is linked to the control it is about; generic failures stay linked to the quantity as before.
  const quantityInvalid = Boolean(error) && !locationError
  const locationOptions = line.availableLocations.map((l) => ({
    value: l.locationId,
    label: `${l.locationCode} (${l.quantity} available)`,
  }))

  function handleLocationChange(next: number | '') {
    setLocationId(next)
    const location = line.availableLocations.find((l) => l.locationId === next)
    if (location) setQuantity(defaultQuantity(remaining, location.quantity))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = parseWholeNumber(quantity)
    if (locationId === '') {
      setLocalError({ field: 'locationId', message: 'Select a location to pick from.' })
      return
    }
    if (parsed === null || parsed < 1) {
      setLocalError({ field: 'quantity', message: 'Enter a whole number of 1 or more.' })
      return
    }
    setLocalError(null)
    const order = await pick.run({ orderLineId: line.id, locationId, quantity: parsed })
    if (order) onPicked(order, `Picked ${parsed} of ${line.sku}.`)
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit} noValidate aria-label={`Pick ${line.sku}`}>
      <label className="visually-hidden" htmlFor={`${baseId}-location`}>
        Pick location for {line.sku}
      </label>
      <OptionSelect
        id={`${baseId}-location`}
        aria-invalid={locationError}
        aria-describedby={locationError ? errorId : undefined}
        value={locationId}
        placeholder="Select location"
        options={locationOptions}
        onChange={handleLocationChange}
      />
      <label className="visually-hidden" htmlFor={`${baseId}-quantity`}>
        Pick quantity for {line.sku}
      </label>
      <input
        id={`${baseId}-quantity`}
        className="input--narrow"
        inputMode="numeric"
        value={quantity}
        aria-invalid={quantityInvalid}
        aria-describedby={quantityInvalid ? errorId : undefined}
        onChange={(e) => setQuantity(e.target.value)}
      />
      <button
        type="submit"
        className="button button--secondary"
        disabled={pick.pending}
        aria-label={pick.pending ? `Picking ${line.sku}` : `Pick ${line.sku}`}
      >
        {pick.pending ? 'Picking…' : 'Pick'}
      </button>
      {error && (
        <small id={errorId} className="field__error" role="alert">
          {error}
        </small>
      )}
    </form>
  )
}
