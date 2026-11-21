import { Suspense, useCallback, useId, useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { features } from '../../features/registry.js';
import { useTranslation } from 'react-i18next';
import AuthButton from './auth-button.jsx';
import BackendStatus from './backend-status.jsx';
import LanguageSwitcher from './language-switcher.jsx';
import Logo from './logo.jsx';
import ThemeToggle from './theme-toggle.jsx';
import GlobalProgress from './feedback/global-progress.jsx';
import ToastRegion from './feedback/toast-region.jsx';
import ConfirmDialogHost from './feedback/confirm-dialog-host.jsx';
import { useDismiss } from './use-dismiss.js';
import { groupFeatures, visibleFeatures } from '../../features/navigation.js';
import Loading from './feedback/loading.jsx';
import Breadcrumbs from './breadcrumbs.jsx';
import { usePermissions } from '../auth/use-can.js';
import { useSession } from '../auth/use-session.js';

export default function Layout() {
  const { t } = useTranslation();

  const permissions = usePermissions();
  const { status } = useSession();
  const navSections = groupFeatures(
    visibleFeatures(features, {
      permissions,
      authenticated: status === 'authenticated',
    })
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef(null);
  const toggleRef = useRef(null);
  const navListId = useId();
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useDismiss({
    open: menuOpen,
    onClose: closeMenu,
    containerRef: headerRef,
    returnFocusRef: toggleRef,
  });

  return (
    <div className="layout">
      <GlobalProgress />
      <a className="skip-link" href="#main-content">
        {t('layout.skipToContent')}
      </a>
      <header ref={headerRef} className="layout-header">
        <div className="layout-header-inner">
          <Link to="/" className="brand-link" aria-label={t('layout.homeLink')}>
            <Logo />
          </Link>

          <nav
            className="layout-nav"
            aria-label={t('layout.primaryNav')}
            data-open={menuOpen}
          >
            {/* The menu always sits behind ☰: the header keeps the same layout at any width. */}
            <button
              ref={toggleRef}
              type="button"
              className="icon-button nav-toggle"
              aria-expanded={menuOpen}
              aria-controls={navListId}
              aria-label={t(menuOpen ? 'layout.closeMenu' : 'layout.openMenu')}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="nav-toggle-bars" aria-hidden="true" />
            </button>
            <div id={navListId} className="nav-panel">
              {navSections.map((section) => {
                const titleId = section.id && `${navListId}-${section.id}`;
                return (
                  <div
                    key={section.id ?? 'top'}
                    className={
                      section.id ? 'nav-group' : 'nav-group nav-group-top'
                    }
                  >
                    {section.labelKey && (
                      <p id={titleId} className="nav-group-title">
                        {t(section.labelKey)}
                      </p>
                    )}
                    <ul
                      className="nav-list"
                      aria-labelledby={titleId || undefined}
                    >
                      {section.items.map((feature) => (
                        <li key={feature.id}>
                          <NavLink
                            to={feature.path}
                            end={feature.path === '/'}
                            onClick={closeMenu}
                          >
                            {t(feature.labelKey)}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </nav>

          <div className="layout-actions">
            <LanguageSwitcher />
            <ThemeToggle />
            <AuthButton />
          </div>
        </div>
      </header>
      <main id="main-content" className="layout-main" tabIndex={-1}>
        <Breadcrumbs features={features} />
        <Suspense fallback={<Loading variant="page" />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="layout-footer">
        <div className="layout-footer-inner">
          <span className="footer-brand">LaPrizza</span>
          <BackendStatus />
        </div>
      </footer>
      <ToastRegion />
      <ConfirmDialogHost />
    </div>
  );
}
