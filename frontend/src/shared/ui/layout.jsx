import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { features } from '../../features/registry.js';
import BackendStatus from './backend-status.jsx';

export default function Layout() {
  return (
    <div className="layout">
      <header className="layout-header">
        <span className="brand">LaPrizza</span>
        <nav aria-label="Primary">
          <ul className="nav-list">
            {features.map((feature) => (
              <li key={feature.id}>
                <NavLink to={feature.path} end={feature.path === '/'}>
                  {feature.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="layout-main">
        <Suspense fallback={<p role="status">Loading...</p>}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="layout-footer">
        <BackendStatus />
      </footer>
    </div>
  );
}
