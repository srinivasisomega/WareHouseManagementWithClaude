// Shapes mirror the backend DTOs in WarehouseInventory.Api/Dtos.

export type Role = 'Admin' | 'Staff'

/**
 * The signed-in user's session.
 * The JWT itself lives only in an HttpOnly cookie that scripts cannot read.
 */
export interface Session {
  username: string
  role: Role
  expiresAtUtc: string
}

export interface Item {
  id: number
  sku: string
  name: string
  description: string | null
  unitOfMeasure: string
  lowStockThreshold: number
  isActive: boolean
}

export interface ItemRequest {
  sku: string
  name: string
  description: string | null
  unitOfMeasure: string
  lowStockThreshold: number
  isActive: boolean
}

export interface Location {
  id: number
  code: string
  name: string
  description: string | null
  isActive: boolean
}

export interface LocationRequest {
  code: string
  name: string
  description: string | null
  isActive: boolean
}

export interface LocationStock {
  locationId: number
  locationCode: string
  locationName: string
  quantity: number
}

export interface InventoryItem {
  itemId: number
  sku: string
  name: string
  unitOfMeasure: string
  totalQuantity: number
  lowStockThreshold: number
  isLowStock: boolean
  locations: LocationStock[]
}

export interface StockAlert {
  itemId: number
  sku: string
  name: string
  totalQuantity: number
  lowStockThreshold: number
  shortfall: number
}

export type MovementType = 'Receipt' | 'Transfer' | 'Pick'

export interface StockMovement {
  id: number
  type: MovementType
  itemId: number
  sku: string
  itemName: string
  fromLocationCode: string | null
  toLocationCode: string | null
  quantity: number
  reference: string | null
  performedBy: string
  createdAtUtc: string
}

export interface ReceiveStockRequest {
  itemId: number
  locationId: number
  quantity: number
  reference: string | null
}

export interface TransferStockRequest {
  itemId: number
  fromLocationId: number
  toLocationId: number
  quantity: number
  reference: string | null
}

export const ORDER_STATUSES = ['Open', 'Picking', 'Picked', 'Packed', 'Dispatched'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export interface OrderSummary {
  id: number
  orderNumber: string
  customerName: string
  status: OrderStatus
  lineCount: number
  totalUnits: number
  createdAtUtc: string
}

export interface OrderLine {
  id: number
  itemId: number
  sku: string
  itemName: string
  quantityOrdered: number
  quantityPicked: number
  availableLocations: LocationStock[]
}

export interface OrderDetail {
  id: number
  orderNumber: string
  customerName: string
  status: OrderStatus
  packageCount: number | null
  carrier: string | null
  trackingNumber: string | null
  createdBy: string
  createdAtUtc: string
  packedAtUtc: string | null
  dispatchedAtUtc: string | null
  lines: OrderLine[]
}

export interface CreateOrderRequest {
  customerName: string
  lines: { itemId: number; quantity: number }[]
}
