import { useState, type FormEvent } from 'react'
import type { Location, LocationRequest } from '../../../api/types'
import { locationsApi } from '../../../api/warehouseApi'
import { FormField } from '../../../components/FormField'
import { ErrorMessage } from '../../../components/StatusMessage'
import { useAsyncAction } from '../../../hooks/useAsyncAction'
import { codeFormatError } from '../../../utils/format'

interface LocationFormProps {
  location: Location | null
  onSaved: (location: Location) => void
  onCancel: () => void
}

type Errors = Partial<Record<'code' | 'name', string>>

export function LocationForm({ location, onSaved, onCancel }: LocationFormProps) {
  const [code, setCode] = useState(location?.code ?? '')
  const [name, setName] = useState(location?.name ?? '')
  const [description, setDescription] = useState(location?.description ?? '')
  const [isActive, setIsActive] = useState(location?.isActive ?? true)
  const [errors, setErrors] = useState<Errors>({})

  const save = useAsyncAction((request: LocationRequest) =>
    location ? locationsApi.update(location.id, request) : locationsApi.create(request),
  )

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const nextErrors: Errors = {
      code: codeFormatError(code, 'Code'),
      name: name.trim() ? undefined : 'Name is required.',
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return

    const saved = await save.run({ code: code.trim(), name: name.trim(), description: description.trim() || null, isActive })
    if (saved) onSaved(saved)
  }

  const fieldError = (key: keyof Errors) => errors[key] ?? save.fieldErrors[key]?.[0]

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate aria-labelledby="location-form-title">
      <h2 id="location-form-title">{location ? `Edit ${location.code}` : 'New location'}</h2>
      {save.error && <ErrorMessage message={save.error} />}
      <div className="form__grid">
        <FormField label="Code" error={fieldError('code')} hint="e.g. A-01-03 or DOCK-1" required>
          {(p) => <input {...p} value={code} maxLength={50} onChange={(e) => setCode(e.target.value)} />}
        </FormField>
        <FormField label="Name" error={fieldError('name')} required>
          {(p) => <input {...p} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />}
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
          {save.pending ? 'Saving…' : 'Save location'}
        </button>
        <button type="button" className="button button--secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
