import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireRole } from './auth/RequireRole'
import { homePathFor, useAuth } from './auth/useAuth'
import { Layout } from './components/Layout'
import { ItemsPage } from './features/admin/items/ItemsPage'
import { LocationsPage } from './features/admin/locations/LocationsPage'
import { ThresholdsPage } from './features/admin/thresholds/ThresholdsPage'
import { AlertsPage } from './features/staff/alerts/AlertsPage'
import { InventoryPage } from './features/staff/inventory/InventoryPage'
import { MoveStockPage } from './features/staff/move/MoveStockPage'
import { MovementsPage } from './features/staff/movements/MovementsPage'
import { CreateOrderPage } from './features/staff/orders/CreateOrderPage'
import { OrderDetailPage } from './features/staff/orders/OrderDetailPage'
import { OrdersPage } from './features/staff/orders/OrdersPage'
import { ReceivePage } from './features/staff/receive/ReceivePage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'

function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={homePathFor(user?.role)} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireRole roles={['Admin', 'Staff']}>
            <Layout />
          </RequireRole>
        }
      >
        <Route index element={<HomeRedirect />} />

        {/* Admin route: master data and alert thresholds */}
        <Route path="admin/items" element={<RequireRole roles={['Admin']}><ItemsPage /></RequireRole>} />
        <Route path="admin/locations" element={<RequireRole roles={['Admin']}><LocationsPage /></RequireRole>} />
        <Route path="admin/thresholds" element={<RequireRole roles={['Admin']}><ThresholdsPage /></RequireRole>} />

        {/* Warehouse staff route (admins may assist) */}
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="receive" element={<ReceivePage />} />
        <Route path="move" element={<MoveStockPage />} />
        <Route path="movements" element={<MovementsPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/new" element={<CreateOrderPage />} />
        <Route path="orders/:id" element={<OrderDetailPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
