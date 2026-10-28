import { Link } from 'react-router-dom'
import { inventoryApi } from '../../../api/warehouseApi'
import { AsyncContent } from '../../../components/AsyncContent'
import { useApiData } from '../../../hooks/useApiData'

export function AlertsPage() {
  const alerts = useApiData(() => inventoryApi.alerts(), 'alerts')

  return (
    <section aria-labelledby="alerts-title">
      <div className="page-header">
        <h1 id="alerts-title">Low-stock alerts</h1>
        <button type="button" className="button button--secondary" onClick={alerts.reload}>
          Refresh
        </button>
      </div>

      <AsyncContent state={alerts} loadingLabel="Loading alerts…" empty="All items are above their low-stock thresholds.">
        {(rows) => (
          <>
            <p>
              <strong>{rows.length}</strong> {rows.length === 1 ? 'item needs' : 'items need'} replenishment.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">SKU</th>
                    <th scope="col">Name</th>
                    <th scope="col" className="num">On hand</th>
                    <th scope="col" className="num">Threshold</th>
                    <th scope="col" className="num">Shortfall</th>
                    <th scope="col">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.itemId} className="row--warning">
                      <td>{a.sku}</td>
                      <td>{a.name}</td>
                      <td className="num">{a.totalQuantity === 0 ? 'Out of stock (0)' : a.totalQuantity}</td>
                      <td className="num">{a.lowStockThreshold}</td>
                      <td className="num">{a.shortfall}</td>
                      <td>
                        <Link to={`/receive?itemId=${a.itemId}`} aria-label={`Receive stock for ${a.sku}`}>
                          Receive
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </AsyncContent>
    </section>
  )
}
