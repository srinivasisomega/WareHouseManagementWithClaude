import { useState } from 'react'
import { inventoryApi } from '../../../api/warehouseApi'
import { AsyncContent } from '../../../components/AsyncContent'
import { FormField } from '../../../components/FormField'
import { StockStatus } from '../../../components/StockStatus'
import { useApiData } from '../../../hooks/useApiData'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { ThresholdRow } from './ThresholdRow'

/** Admin view for tuning per-item low-stock thresholds alongside current on-hand totals. */
export function ThresholdsPage() {
  const [search, setSearch] = useState('')
  const term = useDebouncedValue(search.trim())
  const inventory = useApiData(() => inventoryApi.search({ search: term || undefined }), term)

  return (
    <section aria-labelledby="thresholds-title">
      <h1 id="thresholds-title">Stock-alert thresholds</h1>
      <p className="muted">
        An item is flagged as low stock when its total on hand is at or below its threshold. Set 0 to turn alerts off.
      </p>

      <div className="filters" role="search">
        <FormField label="Search">
          {(p) => (
            <input {...p} type="search" placeholder="SKU or name" value={search} onChange={(e) => setSearch(e.target.value)} />
          )}
        </FormField>
      </div>

      <AsyncContent state={inventory} loadingLabel="Loading items…" empty="No active items match.">
        {(rows) => (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">SKU</th>
                  <th scope="col">Name</th>
                  <th scope="col" className="num">On hand</th>
                  <th scope="col">Status</th>
                  <th scope="col">Threshold</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.itemId}>
                    <td>{row.sku}</td>
                    <td>{row.name}</td>
                    <td className="num">{row.totalQuantity}</td>
                    <td>
                      <StockStatus isLowStock={row.isLowStock} />
                    </td>
                    <td>
                      <ThresholdRow
                        key={row.lowStockThreshold}
                        itemId={row.itemId}
                        sku={row.sku}
                        initial={row.lowStockThreshold}
                        onSaved={inventory.reload}
                      />
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
