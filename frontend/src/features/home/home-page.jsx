import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { features } from '../registry.js';
import BrandLogoLarge from '../../shared/ui/brand-logo-large.jsx';
import { useSession } from '../../shared/auth/use-session.js';
import { visibleFeatures } from '../navigation.js';
import { usePermissions } from '../../shared/auth/use-can.js';

export default function HomePage() {
  const { t } = useTranslation();
  const { status, user } = useSession();

  const permissions = usePermissions();
  const quickLinks = visibleFeatures(features, {
    permissions,
    authenticated: status === 'authenticated',
    phoneRequired: Boolean(user?.phoneRequired),
  }).filter((feature) => feature.path !== '/');

  return (
    <>
      <section className="hero">
        <div>
          <h1>{t('home.welcome')}</h1>
          <p className="hero-lead">{t('home.description')}</p>
          {status === 'anonymous' && (
            <Link className="button" to="/login">
              {t('nav.login')}
            </Link>
          )}
        </div>
        <div className="hero-art">
          <BrandLogoLarge className="hero-logo" />
        </div>
      </section>

      {quickLinks.length > 0 && (
        <section aria-labelledby="quick-access-title">
          <h2 id="quick-access-title" className="section-title">
            {t('home.quickAccess')}
          </h2>
          <ul className="card-grid">
            {quickLinks.map((feature) => (
              <li key={feature.id}>
                <Link className="card" to={feature.path}>
                  <span>{t(feature.labelKey)}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
