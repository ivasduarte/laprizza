import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { features } from '../registry.js';
import logoUrl from '../../shared/assets/logo.png';
import { useSession } from '../../shared/auth/use-session.js';

const quickLinks = features.filter(
  (feature) => feature.showInNav !== false && feature.path !== '/'
);

export default function HomePage() {
  const { t } = useTranslation();
  const { status } = useSession();

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
          <img className="hero-logo" src={logoUrl} alt="" />
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