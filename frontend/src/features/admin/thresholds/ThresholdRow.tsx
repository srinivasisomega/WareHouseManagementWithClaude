import { useState, type FormEvent } from 'react'
import { itemsApi } from '../../../api/warehouseApi'
import { useAsyncAction } from '../../../hooks/useAsyncAction'
import { parseWholeNumber } from '../../../utils/format'

interface ThresholdRowProps {
  itemId: number
  sku: string
  initial: number
  onSaved: () => void
}

export function ThresholdRow({ itemId, sku, initial, onSaved }: ThresholdRowProps) {
  const [value, setValue] = useState(String(initial))
  const [localError, setLocalError] = useState<string | null>(null)
  const save = useAsyncAction((threshold: number) => itemsApi.updateThreshold(itemId, threshold))
  const parsed = parseWholeNumber(value)
  const error = localError ?? save.error

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (parsed === null) {
      setLocalError('Enter a whole number of 0 or more.')
      return
    }
    setLocalError(null)
    if (await save.run(parsed)) onSaved()
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit} noValidate>
      <label className="visually-hidden" htmlFor={`threshold-${itemId}`}>
        Threshold for {sku}
      </label>
      <input
        id={`threshold-${itemId}`}
        className="input--narrow"
        inputMode="numeric"
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `threshold-${itemId}-error` : undefined}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" className="button button--secondary" disabled={save.pending || parsed === initial}>
        {save.pending ? 'Saving…' : 'Save'}
        <span className="visually-hidden"> threshold for {sku}</span>
      </button>
      {error && (
        <small id={`threshold-${itemId}-error`} className="field__error" role="alert">
          {error}
        </small>
      )}
    </form>
  )
}
