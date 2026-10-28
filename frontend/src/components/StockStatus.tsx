/** Low-stock indicator that carries a text label, not just a colour. */
export function StockStatus({ isLowStock }: { isLowStock: boolean }) {
  return isLowStock ? (
    <span className="badge badge--warning">⚠ Low stock</span>
  ) : (
    <span className="badge badge--ok">In stock</span>
  )
}

export function OrderStatusBadge({ status }: { status: string }) {
  return <span className={`badge badge--status badge--${status.toLowerCase()}`}>{status}</span>
}
