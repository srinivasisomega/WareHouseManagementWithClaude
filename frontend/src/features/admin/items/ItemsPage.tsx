import { useState } from 'react'
import type { Item } from '../../../api/types'
import { itemsApi } from '../../../api/warehouseApi'
import { AsyncContent } from '../../../components/AsyncContent'
import { FormField } from '../../../components/FormField'
import { SuccessMessage } from '../../../components/StatusMessage'
import { useApiData } from '../../../hooks/useApiData'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { ItemForm } from './ItemForm'

type Editing = { mode: 'closed' } | { mode: 'new' } | { mode: 'edit'; item: Item }

export function ItemsPage() {
  const [search, setSearch] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [editing, setEditing] = useState<Editing>({ mode: 'closed' })
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const term = useDebouncedValue(search.trim())
  const items = useApiData(
    () => itemsApi.list({ search: term || undefined, includeInactive }),
    JSON.stringify([term, includeInactive]),
  )

  function handleSaved(item: Item) {
    setSavedMessage(`Item ${item.sku} saved.`)
    setEditing({ mode: 'closed' })
    items.reload()
  }

  return (
    <section aria-labelledby="items-title">
      <div className="page-header">
        <h1 id="items-title">Items &amp; SKUs</h1>
        {editing.mode === 'closed' && (
          <button
            type="button"
            className="button"
            onClick={() => {
              setSavedMessage(null)
              setEditing({ mode: 'new' })
            }}
          >
            Add item
          </button>
        )}
      </div>

      {savedMessage && <SuccessMessage>{savedMessage}</SuccessMessage>}
      {editing.mode !== 'closed' && (
        <ItemForm
          key={editing.mode === 'edit' ? editing.item.id : 'new'}
          item={editing.mode === 'edit' ? editing.item : null}
          onSaved={handleSaved}
          onCancel={() => setEditing({ mode: 'closed' })}
        />
      )}

      <div className="filters" role="search">
        <FormField label="Search">
          {(p) => (
            <input {...p} type="search" placeholder="SKU or name" value={search} onChange={(e) => setSearch(e.target.value)} />
          )}
        </FormField>
        <label className="checkbox">
          <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
          Show inactive
        </label>
      </div>

      <AsyncContent state={items} loadingLabel="Loading items…" empty="No items found. Add an item or change the search.">
        {(data) => (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">SKU</th>
                  <th scope="col">Name</th>
                  <th scope="col">Unit</th>
                  <th scope="col" className="num">Low-stock threshold</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id}>
                    <td>{item.sku}</td>
                    <td>{item.name}</td>
                    <td>{item.unitOfMeasure}</td>
                    <td className="num">{item.lowStockThreshold}</td>
                    <td>{item.isActive ? 'Active' : 'Inactive'}</td>
                    <td>
                      <button
                        type="button"
                        className="button button--link"
                        aria-label={`Edit ${item.sku}`}
                        onClick={() => {
                          setSavedMessage(null)
                          setEditing({ mode: 'edit', item })
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
