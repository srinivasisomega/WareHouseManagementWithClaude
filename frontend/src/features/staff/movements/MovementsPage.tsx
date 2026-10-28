import { useState } from 'react'
import { stockApi } from '../../../api/warehouseApi'
import { AsyncContent } from '../../../components/AsyncContent'
import { FormField } from '../../../components/FormField'
import { OptionSelect } from '../../../components/OptionSelect'
import { ErrorMessage } from '../../../components/StatusMessage'
import { useApiData } from '../../../hooks/useApiData'
import { useActiveItems, useActiveLocations } from '../../../hooks/useReferenceData'
import { formatDateTime, itemOption, locationOption } from '../../../utils/format'

export function MovementsPage() {
  const [itemId, setItemId] = useState<number | ''>('')
  const [locationId, setLocationId] = useState<number | ''>('')
  const items = useActiveItems()
  const locations = useActiveLocations()

  const filters = { itemId: itemId || undefined, locationId: locationId || undefined }
  const movements = useApiData(() => stockApi.movements(filters), JSON.stringify(filters))

  return (
    <section aria-labelledby="movements-title">
      <h1 id="movements-title">Movement history</h1>

      {items.error && <ErrorMessage message={`Could not load items. ${items.error}`} onRetry={items.reload} />}
      {locations.error && (
        <ErrorMessage message={`Could not load locations. ${locations.error}`} onRetry={locations.reload} />
      )}
      <div className="filters" role="search" aria-label="Filter movements">
        <FormField label="Item">
          {(p) => (
            <OptionSelect
              {...p}
              value={itemId}
              placeholder="All items"
              options={(items.data ?? []).map(itemOption)}
              onChange={setItemId}
            />
          )}
        </FormField>
        <FormField label="Location">
          {(p) => (
            <OptionSelect
              {...p}
              value={locationId}
              placeholder="All locations"
              options={(locations.data ?? []).map(locationOption)}
              onChange={setLocationId}
            />
          )}
        </FormField>
      </div>

      <AsyncContent state={movements} loadingLabel="Loading movements…" empty="No stock movements match these filters.">
        {(rows) => (
          <div className="table-wrap">
            <table>
              <caption className="visually-hidden">Stock movements, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Type</th>
                  <th scope="col">SKU</th>
                  <th scope="col">Item</th>
                  <th scope="col">From</th>
                  <th scope="col">To</th>
                  <th scope="col" className="num">Quantity</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Performed by</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td>{formatDateTime(m.createdAtUtc)}</td>
                    <td>{m.type}</td>
                    <td>{m.sku}</td>
                    <td>{m.itemName}</td>
                    <td>{m.fromLocationCode ?? '—'}</td>
                    <td>{m.toLocationCode ?? '—'}</td>
                    <td className="num">{m.quantity}</td>
                    <td>{m.reference ?? <span className="muted">—</span>}</td>
                    <td>{m.performedBy}</td>
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
