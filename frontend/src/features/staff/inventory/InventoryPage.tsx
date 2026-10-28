import { useState } from 'react'
import { inventoryApi } from '../../../api/warehouseApi'
import { AsyncContent } from '../../../components/AsyncContent'
import { FormField } from '../../../components/FormField'
import { OptionSelect } from '../../../components/OptionSelect'
import { ErrorMessage } from '../../../components/StatusMessage'
import { StockStatus } from '../../../components/StockStatus'
import { useApiData } from '../../../hooks/useApiData'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { useActiveLocations } from '../../../hooks/useReferenceData'
import { locationOption } from '../../../utils/format'

export function InventoryPage() {
  const [search, setSearch] = useState('')
  const [locationId, setLocationId] = useState<number | ''>('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const term = useDebouncedValue(search.trim())
  const locations = useActiveLocations()

  const filters = { search: term || undefined, locationId: locationId || undefined, lowStockOnly: lowStockOnly || undefined }
  const inventory = useApiData(() => inventoryApi.search(filters), JSON.stringify(filters))

  return (
    <section aria-labelledby="inventory-title">
      <h1 id="inventory-title">Inventory</h1>

      {locations.error && (
        <ErrorMessage message={`Could not load locations. ${locations.error}`} onRetry={locations.reload} />
      )}
      <div className="filters" role="search">
        <FormField label="Search">
          {(p) => (
            <input {...p} type="search" placeholder="SKU or name" value={search} onChange={(e) => setSearch(e.target.value)} />
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
        <label className="checkbox">
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
          Low stock only
        </label>
      </div>

      <AsyncContent state={inventory} loadingLabel="Loading inventory…" empty="No items match these filters.">
        {(rows) => (
          <div className="table-wrap">
            <table>
              <caption className="visually-hidden">Inventory by item</caption>
              <thead>
                <tr>
                  <th scope="col">SKU</th>
                  <th scope="col">Name</th>
                  <th scope="col" className="num">On hand</th>
                  <th scope="col" className="num">Threshold</th>
                  <th scope="col">Status</th>
                  <th scope="col">Locations</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.itemId} className={row.isLowStock ? 'row--warning' : undefined}>
                    <td>{row.sku}</td>
                    <td>{row.name}</td>
                    <td className="num">
                      {row.totalQuantity} {row.unitOfMeasure}
                    </td>
                    <td className="num">{row.lowStockThreshold || '—'}</td>
                    <td>
                      <StockStatus isLowStock={row.isLowStock} />
                    </td>
                    <td>
                      {row.locations.length === 0 ? (
                        <span className="muted">None</span>
                      ) : (
                        <ul className="plain-list">
                          {row.locations.map((l) => (
                            <li key={l.locationId}>
                              {l.locationCode}: {l.quantity}
                            </li>
                          ))}
                        </ul>
                      )}
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
