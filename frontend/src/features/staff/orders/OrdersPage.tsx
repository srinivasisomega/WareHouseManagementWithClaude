import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ORDER_STATUSES, type OrderStatus } from '../../../api/types'
import { ordersApi } from '../../../api/warehouseApi'
import { AsyncContent } from '../../../components/AsyncContent'
import { FormField } from '../../../components/FormField'
import { OrderStatusBadge } from '../../../components/StockStatus'
import { useApiData } from '../../../hooks/useApiData'
import { formatDateTime } from '../../../utils/format'

export function OrdersPage() {
  const [status, setStatus] = useState<OrderStatus | ''>('')
  const orders = useApiData(() => ordersApi.list(status || undefined), status)

  return (
    <section aria-labelledby="orders-title">
      <div className="page-header">
        <h1 id="orders-title">Orders</h1>
        <Link to="/orders/new" className="button">
          New order
        </Link>
      </div>

      <div className="filters" role="search">
        <FormField label="Status">
          {(p) => (
            <select {...p} value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | '')}>
              <option value="">All statuses</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </FormField>
      </div>

      <AsyncContent
        state={orders}
        loadingLabel="Loading orders…"
        empty={status ? `No ${status} orders.` : 'No orders yet. Create a new order to get started.'}
      >
        {(rows) => (
          <div className="table-wrap">
            <table>
              <caption className="visually-hidden">Orders</caption>
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">Lines</th>
                  <th scope="col" className="num">Units</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link to={`/orders/${order.id}`}>{order.orderNumber}</Link>
                    </td>
                    <td>{order.customerName}</td>
                    <td>
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="num">{order.lineCount}</td>
                    <td className="num">{order.totalUnits}</td>
                    <td>{formatDateTime(order.createdAtUtc)}</td>
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
