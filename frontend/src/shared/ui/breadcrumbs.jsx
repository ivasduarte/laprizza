import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { breadcrumbTrail } from '../../features/navigation.js';

/**
 * WEB02: where the user is (Home › Section › Page › Detail › Edit), with a one-click way
 * back to every level. Rendered above the page content; nothing on the home page.
 */
export default function Breadcrumbs({ features }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const trail = breadcrumbTrail(pathname, params, features);
  if (trail.length === 0) return null;

  return (
    <nav className="breadcrumbs" aria-label={t('breadcrumbs.label')}>
      <ol>
        {trail.map((crumb, index) => {
          const current = index === trail.length - 1;
          return (
            <li key={`${crumb.labelKey}-${index}`}>
              {crumb.to ? (
                <Link to={crumb.to}>{t(crumb.labelKey)}</Link>
              ) : (
                <span aria-current={current ? 'page' : undefined}>
                  {t(crumb.labelKey)}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
