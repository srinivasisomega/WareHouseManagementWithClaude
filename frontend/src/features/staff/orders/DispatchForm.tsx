import { useState, type FormEvent } from 'react'
import type { OrderDetail } from '../../../api/types'
import { ordersApi } from '../../../api/warehouseApi'
import { FormField } from '../../../components/FormField'
import { ErrorMessage } from '../../../components/StatusMessage'
import { useAsyncAction } from '../../../hooks/useAsyncAction'

interface DispatchFormProps {
  orderId: number
  onDispatched: (order: OrderDetail, message: string) => void
}

interface DispatchRequest {
  carrier: string
  trackingNumber: string | null
}

type Errors = Partial<Record<'carrier' | 'trackingNumber', string>>

const MAX_LENGTH = 100

export function DispatchForm({ orderId, onDispatched }: DispatchFormProps) {
  const [carrier, setCarrier] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const dispatch = useAsyncAction((request: DispatchRequest) => ordersApi.dispatch(orderId, request))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const nextErrors: Errors = {
      carrier: !carrier.trim()
        ? 'Carrier is required.'
        : carrier.trim().length > MAX_LENGTH
          ? `Carrier must be ${MAX_LENGTH} characters or fewer.`
          : undefined,
      trackingNumber:
        trackingNumber.trim().length > MAX_LENGTH
          ? `Tracking number must be ${MAX_LENGTH} characters or fewer.`
          : undefined,
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return

    const order = await dispatch.run({ carrier: carrier.trim(), trackingNumber: trackingNumber.trim() || null })
    if (order) onDispatched(order, `Order ${order.orderNumber} dispatched via ${order.carrier ?? carrier.trim()}.`)
  }

  const fieldError = (key: keyof Errors) => errors[key] ?? dispatch.fieldErrors[key]?.[0]

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate aria-labelledby="dispatch-form-title">
      <h2 id="dispatch-form-title">Dispatch order</h2>
      {dispatch.error && <ErrorMessage message={dispatch.error} />}
      <div className="form__grid">
        <FormField label="Carrier" error={fieldError('carrier')} required>
          {(p) => <input {...p} value={carrier} maxLength={MAX_LENGTH} onChange={(e) => setCarrier(e.target.value)} />}
        </FormField>
        <FormField label="Tracking number" error={fieldError('trackingNumber')} hint="Optional">
          {(p) => (
            <input
              {...p}
              value={trackingNumber}
              maxLength={MAX_LENGTH}
              onChange={(e) => setTrackingNumber(e.target.value)}
            />
          )}
        </FormField>
      </div>
      <div className="form__actions">
        <button type="submit" className="button" disabled={dispatch.pending}>
          {dispatch.pending ? 'Dispatching…' : 'Dispatch order'}
        </button>
      </div>
    </form>
  )
}
