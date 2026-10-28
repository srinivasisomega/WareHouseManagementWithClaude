import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../../../api/client'
import type { OrderDetail } from '../../../api/types'
import { ordersApi } from '../../../api/warehouseApi'
import { AsyncContent } from '../../../components/AsyncContent'
import { SuccessMessage } from '../../../components/StatusMessage'
import { useApiData } from '../../../hooks/useApiData'
import { DispatchForm } from './DispatchForm'
import { OrderLinesTable } from './OrderLinesTable'
import { OrderSummaryCard } from './OrderSummaryCard'
import { PackForm } from './PackForm'

function parseOrderId(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null
  const id = Number(raw)
  return id > 0 ? id : null
}

export function OrderDetailPage() {
  const { id: rawId } = useParams()
  const orderId = parseOrderId(rawId)
  const [updated, setUpdated] = useState<OrderDetail | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const detail = useApiData(
    () => (orderId ? ordersApi.get(orderId) : Promise.reject(new ApiError(404, 'The requested order was not found.'))),
    String(orderId),
  )
  // Show the order returned by the latest action; fall back to the loaded order.
  const current = updated && updated.id === orderId ? updated : detail.data
  const state = { ...detail, data: current }

  function handleUpdated(order: OrderDetail, successMessage: string) {
    setUpdated(order)
    setMessage(successMessage)
  }

  return (
    <section aria-labelledby="order-title">
      <div className="page-header">
        <h1 id="order-title">{current ? `Order ${current.orderNumber}` : 'Order'}</h1>
        <Link to="/orders">Back to orders</Link>
      </div>

      {message && <SuccessMessage>{message}</SuccessMessage>}

      <AsyncContent state={state} loadingLabel="Loading order…" empty="Order not found." isEmpty={() => false}>
        {(order) => (
          <div className="stack">
            <OrderSummaryCard order={order} />
            <OrderLinesTable order={order} onPicked={handleUpdated} />
            {order.status === 'Picked' && <PackForm orderId={order.id} onPacked={handleUpdated} />}
            {order.status === 'Packed' && <DispatchForm orderId={order.id} onDispatched={handleUpdated} />}
          </div>
        )}
      </AsyncContent>
    </section>
  )
}
