import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="not-found-title">
      <h1 id="not-found-title">{t('access.notFoundTitle')}</h1>
      <p className="message">{t('access.notFoundMessage')}</p>
      <p>
        <Link className="button" to="/">
          {t('access.goHome')}
        </Link>
      </p>
    </section>
  );
}
