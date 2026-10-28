import type { OrderDetail } from '../../../api/types'
import { PickLineForm } from './PickLineForm'

interface OrderLinesTableProps {
  order: OrderDetail
  onPicked: (order: OrderDetail, message: string) => void
}

export function OrderLinesTable({ order, onPicked }: OrderLinesTableProps) {
  const canPick = order.status === 'Open' || order.status === 'Picking'

  return (
    <div className="table-wrap">
      <table>
        <caption className="visually-hidden">Order lines</caption>
        <thead>
          <tr>
            <th scope="col">SKU</th>
            <th scope="col">Item</th>
            <th scope="col" className="num">Ordered</th>
            <th scope="col" className="num">Picked</th>
            <th scope="col" className="num">Remaining</th>
            {canPick && <th scope="col">Pick</th>}
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line) => {
            const remaining = line.quantityOrdered - line.quantityPicked
            return (
              <tr key={line.id}>
                <td>{line.sku}</td>
                <td>{line.itemName}</td>
                <td className="num">{line.quantityOrdered}</td>
                <td className="num">{line.quantityPicked}</td>
                <td className="num">{remaining}</td>
                {canPick && (
                  <td>
                    {remaining > 0 ? (
                      <PickLineForm
                        // Reset the form's defaults whenever the line's picked quantity or stock changes.
                        key={`${line.id}-${line.quantityPicked}`}
                        orderId={order.id}
                        line={line}
                        onPicked={onPicked}
                      />
                    ) : (
                      <span className="badge badge--ok">Fully picked</span>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
