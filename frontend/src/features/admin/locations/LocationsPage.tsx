import { useState } from 'react'
import type { Location } from '../../../api/types'
import { locationsApi } from '../../../api/warehouseApi'
import { AsyncContent } from '../../../components/AsyncContent'
import { SuccessMessage } from '../../../components/StatusMessage'
import { useApiData } from '../../../hooks/useApiData'
import { LocationForm } from './LocationForm'

type Editing = { mode: 'closed' } | { mode: 'new' } | { mode: 'edit'; location: Location }

export function LocationsPage() {
  const [editing, setEditing] = useState<Editing>({ mode: 'closed' })
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const locations = useApiData(() => locationsApi.list({ includeInactive: true }), 'all-locations')

  function handleSaved(location: Location) {
    setSavedMessage(`Location ${location.code} saved.`)
    setEditing({ mode: 'closed' })
    locations.reload()
  }

  return (
    <section aria-labelledby="locations-title">
      <div className="page-header">
        <h1 id="locations-title">Warehouse locations</h1>
        {editing.mode === 'closed' && (
          <button
            type="button"
            className="button"
            onClick={() => {
              setSavedMessage(null)
              setEditing({ mode: 'new' })
            }}
          >
            Add location
          </button>
        )}
      </div>

      {savedMessage && <SuccessMessage>{savedMessage}</SuccessMessage>}
      {editing.mode !== 'closed' && (
        <LocationForm
          key={editing.mode === 'edit' ? editing.location.id : 'new'}
          location={editing.mode === 'edit' ? editing.location : null}
          onSaved={handleSaved}
          onCancel={() => setEditing({ mode: 'closed' })}
        />
      )}

      <AsyncContent
        state={locations}
        loadingLabel="Loading locations…"
        empty="No locations yet. Add a receiving dock and storage bins to start."
      >
        {(data) => (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Name</th>
                  <th scope="col">Description</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((location) => (
                  <tr key={location.id}>
                    <td>{location.code}</td>
                    <td>{location.name}</td>
                    <td>{location.description ?? '—'}</td>
                    <td>{location.isActive ? 'Active' : 'Inactive'}</td>
                    <td>
                      <button
                        type="button"
                        className="button button--link"
                        aria-label={`Edit ${location.code}`}
                        onClick={() => {
                          setSavedMessage(null)
                          setEditing({ mode: 'edit', location })
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AsyncContent>
    </section>
  )
}
