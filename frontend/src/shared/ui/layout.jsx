import { Suspense } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { features } from '../../features/registry.js';
import { useTranslation } from 'react-i18next';
import BackendStatus from './backend-status.jsx';
import LanguageSwitcher from './language-switcher.jsx';
import Logo from './logo.jsx';

export default function Layout() {
  const { t } = useTranslation();

  return (
    <div className="layout">
      <a className="skip-link" href="#main-content">
        {t('layout.skipToContent')}
      </a>
      <header className="layout-header">
        <Link to="/" className="brand-link" aria-label={t('layout.homeLink')}>
          <Logo />
        </Link>
        <nav className="layout-nav" aria-label={t('layout.primaryNav')}>
          <ul className="nav-list">
            {features.map((feature) => (
              <li key={feature.id}>
                <NavLink to={feature.path} end={feature.path === '/'}>
                  {t(feature.labelKey)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <LanguageSwitcher />
      </header>
      <main id="main-content" className="layout-main" tabIndex={-1}>
        <Suspense fallback={<p role="status">{t('layout.loading')}</p>}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="layout-footer">
        <BackendStatus />
      </footer>
    </div>
  );
}
