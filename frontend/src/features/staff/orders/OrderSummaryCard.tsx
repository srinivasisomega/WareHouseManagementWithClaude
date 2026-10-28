import type { OrderDetail } from '../../../api/types'
import { OrderStatusBadge } from '../../../components/StockStatus'
import { formatDateTime } from '../../../utils/format'

/** Read-only header details for an order, including packing and dispatch information once available. */
export function OrderSummaryCard({ order }: { order: OrderDetail }) {
  return (
    <div className="card" role="group" aria-label="Order details">
      <dl className="detail-list">
        <div>
          <dt>Order number</dt>
          <dd>{order.orderNumber}</dd>
        </div>
        <div>
          <dt>Customer</dt>
          <dd>{order.customerName}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <OrderStatusBadge status={order.status} />
          </dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>
            {formatDateTime(order.createdAtUtc)} by {order.createdBy}
          </dd>
        </div>
        {order.packedAtUtc && (
          <div>
            <dt>Packed</dt>
            <dd>
              {formatDateTime(order.packedAtUtc)}
              {order.packageCount !== null &&
                ` — ${order.packageCount} package${order.packageCount === 1 ? '' : 's'}`}
            </dd>
          </div>
        )}
        {order.status === 'Dispatched' && (
          <>
            <div>
              <dt>Dispatched</dt>
              <dd>{formatDateTime(order.dispatchedAtUtc)}</dd>
            </div>
            <div>
              <dt>Carrier</dt>
              <dd>{order.carrier ?? '—'}</dd>
            </div>
            <div>
              <dt>Tracking number</dt>
              <dd>{order.trackingNumber ?? <span className="muted">Not provided</span>}</dd>
            </div>
          </>
        )}
      </dl>
      {order.status === 'Dispatched' && <p className="muted">This order has been dispatched and is read-only.</p>}
    </div>
  )
}
