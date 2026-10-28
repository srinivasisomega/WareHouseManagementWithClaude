import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

const adminLinks = [
  { to: '/admin/items', label: 'Items & SKUs' },
  { to: '/admin/locations', label: 'Locations' },
  { to: '/admin/thresholds', label: 'Stock alerts' },
]

const staffLinks = [
  { to: '/inventory', label: 'Inventory' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/receive', label: 'Receive' },
  { to: '/move', label: 'Move' },
  { to: '/orders', label: 'Pick / Pack / Dispatch' },
  { to: '/movements', label: 'History' },
]

export function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="app-header">
        <span className="app-header__brand">Warehouse Inventory</span>
        <nav aria-label="Main">
          {user?.role === 'Admin' && <NavGroup label="Admin" links={adminLinks} />}
          <NavGroup label={user?.role === 'Admin' ? 'Operations' : 'Warehouse'} links={staffLinks} />
        </nav>
        <div className="app-header__user">
          <span>
            {user?.username} <small>({user?.role})</small>
          </span>
          <button type="button" className="button button--secondary" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      <main id="main-content" className="app-main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  )
}

function NavGroup({ label, links }: { label: string; links: { to: string; label: string }[] }) {
  return (
    <div className="nav-group">
      <span className="nav-group__label">{label}</span>
      <ul>
        {links.map((link) => (
          <li key={link.to}>
            <NavLink to={link.to}>{link.label}</NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
