import { apiRequest } from './client'
import type {
  CreateOrderRequest,
  InventoryItem,
  Item,
  ItemRequest,
  Location,
  LocationRequest,
  Session,
  OrderDetail,
  OrderStatus,
  OrderSummary,
  ReceiveStockRequest,
  StockAlert,
  StockMovement,
  TransferStockRequest,
} from './types'

export const authApi = {
  login: (username: string, password: string) =>
    apiRequest<Session>('/auth/login', { method: 'POST', body: { username, password } }),
  me: () => apiRequest<Session>('/auth/me'),
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST' }),
}

export const itemsApi = {
  list: (params: { search?: string; includeInactive?: boolean } = {}) =>
    apiRequest<Item[]>('/items', { query: params }),
  create: (request: ItemRequest) => apiRequest<Item>('/items', { method: 'POST', body: request }),
  update: (id: number, request: ItemRequest) =>
    apiRequest<Item>(`/items/${id}`, { method: 'PUT', body: request }),
  updateThreshold: (id: number, lowStockThreshold: number) =>
    apiRequest<Item>(`/items/${id}/threshold`, { method: 'PUT', body: { lowStockThreshold } }),
}

export const locationsApi = {
  list: (params: { includeInactive?: boolean } = {}) =>
    apiRequest<Location[]>('/locations', { query: params }),
  create: (request: LocationRequest) =>
    apiRequest<Location>('/locations', { method: 'POST', body: request }),
  update: (id: number, request: LocationRequest) =>
    apiRequest<Location>(`/locations/${id}`, { method: 'PUT', body: request }),
}

export const inventoryApi = {
  search: (params: { search?: string; locationId?: number; lowStockOnly?: boolean } = {}) =>
    apiRequest<InventoryItem[]>('/inventory', { query: params }),
  alerts: () => apiRequest<StockAlert[]>('/inventory/alerts'),
}

export const stockApi = {
  receive: (request: ReceiveStockRequest) =>
    apiRequest<StockMovement>('/stock/receipts', { method: 'POST', body: request }),
  transfer: (request: TransferStockRequest) =>
    apiRequest<StockMovement>('/stock/transfers', { method: 'POST', body: request }),
  movements: (params: { itemId?: number; locationId?: number; take?: number } = {}) =>
    apiRequest<StockMovement[]>('/stock/movements', { query: params }),
}

export const ordersApi = {
  list: (status?: OrderStatus) => apiRequest<OrderSummary[]>('/orders', { query: { status } }),
  get: (id: number) => apiRequest<OrderDetail>(`/orders/${id}`),
  create: (request: CreateOrderRequest) =>
    apiRequest<OrderDetail>('/orders', { method: 'POST', body: request }),
  pick: (id: number, request: { orderLineId: number; locationId: number; quantity: number }) =>
    apiRequest<OrderDetail>(`/orders/${id}/pick`, { method: 'POST', body: request }),
  pack: (id: number, packageCount: number) =>
    apiRequest<OrderDetail>(`/orders/${id}/pack`, { method: 'POST', body: { packageCount } }),
  dispatch: (id: number, request: { carrier: string; trackingNumber: string | null }) =>
    apiRequest<OrderDetail>(`/orders/${id}/dispatch`, { method: 'POST', body: request }),
}
