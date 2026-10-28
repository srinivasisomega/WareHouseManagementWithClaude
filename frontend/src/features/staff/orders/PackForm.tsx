import { useState, type FormEvent } from 'react'
import type { OrderDetail } from '../../../api/types'
import { ordersApi } from '../../../api/warehouseApi'
import { FormField } from '../../../components/FormField'
import { ErrorMessage } from '../../../components/StatusMessage'
import { useAsyncAction } from '../../../hooks/useAsyncAction'
import { parseWholeNumber } from '../../../utils/format'

interface PackFormProps {
  orderId: number
  onPacked: (order: OrderDetail, message: string) => void
}

export function PackForm({ orderId, onPacked }: PackFormProps) {
  const [packageCount, setPackageCount] = useState('1')
  const [localError, setLocalError] = useState<string | null>(null)
  const pack = useAsyncAction((count: number) => ordersApi.pack(orderId, count))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = parseWholeNumber(packageCount)
    if (parsed === null || parsed < 1) {
      setLocalError('Enter a whole number of 1 or more.')
      return
    }
    setLocalError(null)
    const order = await pack.run(parsed)
    if (order) onPacked(order, `Order ${order.orderNumber} packed in ${parsed} package${parsed === 1 ? '' : 's'}.`)
  }

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate aria-labelledby="pack-form-title">
      <h2 id="pack-form-title">Pack order</h2>
      {pack.error && <ErrorMessage message={pack.error} />}
      <FormField label="Package count" error={localError ?? pack.fieldErrors.packageCount?.[0]} required>
        {(p) => (
          <input {...p} inputMode="numeric" value={packageCount} onChange={(e) => setPackageCount(e.target.value)} />
        )}
      </FormField>
      <div className="form__actions">
        <button type="submit" className="button" disabled={pack.pending}>
          {pack.pending ? 'Packing…' : 'Mark as packed'}
        </button>
      </div>
    </form>
  )
}
