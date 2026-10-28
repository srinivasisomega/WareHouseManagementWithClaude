import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { CreateOrderRequest } from '../../../api/types'
import { ordersApi } from '../../../api/warehouseApi'
import { FormField } from '../../../components/FormField'
import { OptionSelect, type Option } from '../../../components/OptionSelect'
import { ErrorMessage } from '../../../components/StatusMessage'
import { useAsyncAction } from '../../../hooks/useAsyncAction'
import { useActiveItems } from '../../../hooks/useReferenceData'
import { itemOption, parseWholeNumber } from '../../../utils/format'

interface DraftLine {
  key: number
  itemId: number | ''
  quantity: string
}

interface LineErrors {
  itemId?: string
  quantity?: string
}

interface FormErrors {
  customerName?: string
  lines: LineErrors[]
}

const MAX_CUSTOMER_NAME = 200

function validate(customerName: string, lines: DraftLine[]): FormErrors {
  const name = customerName.trim()
  const errors: FormErrors = {
    customerName: !name
      ? 'Customer name is required.'
      : name.length > MAX_CUSTOMER_NAME
        ? `Customer name must be ${MAX_CUSTOMER_NAME} characters or fewer.`
        : undefined,
    lines: lines.map(() => ({})),
  }

  const seen = new Set<number>()
  lines.forEach((line, index) => {
    if (line.itemId === '') {
      errors.lines[index].itemId = 'Select an item.'
    } else if (seen.has(line.itemId)) {
      errors.lines[index].itemId = 'This item is already on the order. Combine the quantities on one line.'
    } else {
      seen.add(line.itemId)
    }
    const quantity = parseWholeNumber(line.quantity)
    if (quantity === null || quantity < 1) errors.lines[index].quantity = 'Enter a whole number of 1 or more.'
  })
  return errors
}

const hasErrors = (errors: FormErrors) =>
  Boolean(errors.customerName) || errors.lines.some((l) => l.itemId || l.quantity)

export function CreateOrderPage() {
  const navigate = useNavigate()
  const items = useActiveItems()
  const nextKey = useRef(1)
  const [customerName, setCustomerName] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([{ key: 0, itemId: '', quantity: '1' }])
  const [errors, setErrors] = useState<FormErrors>({ lines: [] })
  const create = useAsyncAction((request: CreateOrderRequest) => ordersApi.create(request))

  const itemOptions: Option[] = (items.data ?? []).map(itemOption)

  function updateLine(key: number, change: Partial<DraftLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...change } : line)))
  }

  function addLine() {
    setLines((current) => [...current, { key: nextKey.current++, itemId: '', quantity: '1' }])
  }

  function removeLine(key: number) {
    setLines((current) => current.filter((line) => line.key !== key))
    setErrors({ lines: [] })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const nextErrors = validate(customerName, lines)
    setErrors(nextErrors)
    if (hasErrors(nextErrors)) return

    const order = await create.run({
      customerName: customerName.trim(),
      lines: lines.map((line) => ({ itemId: line.itemId as number, quantity: parseWholeNumber(line.quantity)! })),
    })
    if (order) navigate(`/orders/${order.id}`)
  }

  const serverError = (key: string) => create.fieldErrors[key]?.[0]
  const linesError = serverError('lines')

  return (
    <section aria-labelledby="create-order-title">
      <div className="page-header">
        <h1 id="create-order-title">New order</h1>
        <Link to="/orders">Back to orders</Link>
      </div>

      <form className="card form" onSubmit={handleSubmit} noValidate aria-labelledby="create-order-title">
        {create.error && <ErrorMessage message={create.error} />}
        {items.error && <ErrorMessage message={`Items could not be loaded: ${items.error}`} onRetry={items.reload} />}

        <FormField label="Customer name" error={errors.customerName ?? serverError('customerName')} required>
          {(p) => (
            <input
              {...p}
              value={customerName}
              maxLength={MAX_CUSTOMER_NAME}
              autoComplete="off"
              onChange={(e) => setCustomerName(e.target.value)}
            />
          )}
        </FormField>

        <fieldset className="stack">
          <legend>Order lines</legend>
          {linesError && (
            <p className="field__error" role="alert">
              {linesError}
            </p>
          )}
          {lines.map((line, index) => {
            const lineErrors = errors.lines[index] ?? {}
            const lineNumber = index + 1
            return (
              <div key={line.key} className="form__grid" role="group" aria-label={`Line ${lineNumber}`}>
                <FormField
                  label={`Item (line ${lineNumber})`}
                  error={lineErrors.itemId ?? serverError(`lines[${index}].itemId`)}
                  required
                >
                  {(p) => (
                    <OptionSelect
                      {...p}
                      value={line.itemId}
                      options={itemOptions}
                      placeholder={items.loading && !items.data ? 'Loading items…' : 'Select an item'}
                      onChange={(itemId) => updateLine(line.key, { itemId })}
                    />
                  )}
                </FormField>
                <FormField
                  label={`Quantity (line ${lineNumber})`}
                  error={lineErrors.quantity ?? serverError(`lines[${index}].quantity`)}
                  required
                >
                  {(p) => (
                    <input
                      {...p}
                      inputMode="numeric"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                    />
                  )}
                </FormField>
                <div className="form__actions">
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => removeLine(line.key)}
                    disabled={lines.length === 1}
                    aria-label={`Remove line ${lineNumber}`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          })}
          <div className="form__actions">
            <button type="button" className="button button--secondary" onClick={addLine}>
              Add line
            </button>
          </div>
        </fieldset>

        <div className="form__actions">
          <button type="submit" className="button" disabled={create.pending}>
            {create.pending ? 'Creating…' : 'Create order'}
          </button>
          <Link to="/orders" className="button button--secondary">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  )
}
