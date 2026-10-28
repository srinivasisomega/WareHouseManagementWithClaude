import { useState, type FormEvent } from 'react'
import type { Item, ItemRequest } from '../../../api/types'
import { itemsApi } from '../../../api/warehouseApi'
import { FormField } from '../../../components/FormField'
import { ErrorMessage } from '../../../components/StatusMessage'
import { useAsyncAction } from '../../../hooks/useAsyncAction'
import { codeFormatError, parseWholeNumber } from '../../../utils/format'

interface ItemFormProps {
  item: Item | null
  onSaved: (item: Item) => void
  onCancel: () => void
}

type Errors = Partial<Record<'sku' | 'name' | 'unitOfMeasure' | 'lowStockThreshold', string>>

export function ItemForm({ item, onSaved, onCancel }: ItemFormProps) {
  const [sku, setSku] = useState(item?.sku ?? '')
  const [name, setName] = useState(item?.name ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [unitOfMeasure, setUnitOfMeasure] = useState(item?.unitOfMeasure ?? 'EA')
  const [threshold, setThreshold] = useState(String(item?.lowStockThreshold ?? 0))
  const [isActive, setIsActive] = useState(item?.isActive ?? true)
  const [errors, setErrors] = useState<Errors>({})

  const save = useAsyncAction((request: ItemRequest) =>
    item ? itemsApi.update(item.id, request) : itemsApi.create(request),
  )

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const lowStockThreshold = parseWholeNumber(threshold)
    const nextErrors: Errors = {
      sku: codeFormatError(sku, 'SKU'),
      name: name.trim() ? undefined : 'Name is required.',
      unitOfMeasure: unitOfMeasure.trim() ? undefined : 'Unit of measure is required.',
      lowStockThreshold: lowStockThreshold === null ? 'Enter a whole number of 0 or more.' : undefined,
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return

    const saved = await save.run({
      sku: sku.trim(),
      name: name.trim(),
      description: description.trim() || null,
      unitOfMeasure: unitOfMeasure.trim(),
      lowStockThreshold: lowStockThreshold!,
      isActive,
    })
    if (saved) onSaved(saved)
  }

  const fieldError = (key: keyof Errors) => errors[key] ?? save.fieldErrors[key]?.[0]

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate aria-labelledby="item-form-title">
      <h2 id="item-form-title">{item ? `Edit ${item.sku}` : 'New item'}</h2>
      {save.error && <ErrorMessage message={save.error} />}
      <div className="form__grid">
        <FormField label="SKU" error={fieldError('sku')} required>
          {(p) => <input {...p} value={sku} maxLength={50} onChange={(e) => setSku(e.target.value)} />}
        </FormField>
        <FormField label="Name" error={fieldError('name')} required>
          {(p) => <input {...p} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />}
        </FormField>
        <FormField label="Unit of measure" error={fieldError('unitOfMeasure')} hint="e.g. EA, BOX, KG" required>
          {(p) => (
            <input {...p} value={unitOfMeasure} maxLength={20} onChange={(e) => setUnitOfMeasure(e.target.value)} />
          )}
        </FormField>
        <FormField
          label="Low-stock threshold"
          error={fieldError('lowStockThreshold')}
          hint="Alert when total on hand is at or below this. 0 disables alerts."
        >
          {(p) => (
            <input {...p} inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          )}
        </FormField>
      </div>
      <FormField label="Description">
        {(p) => (
          <textarea {...p} rows={2} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
        )}
      </FormField>
      <label className="checkbox">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Active
      </label>
      <div className="form__actions">
        <button type="submit" className="button" disabled={save.pending}>
          {save.pending ? 'Saving…' : 'Save item'}
        </button>
        <button type="button" className="button button--secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
