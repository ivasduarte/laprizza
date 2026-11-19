import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function AccessDenied() {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="access-denied-title">
      <h1 id="access-denied-title">{t('access.deniedTitle')}</h1>
      <p className="message message-error" role="alert">
        {t('access.deniedMessage')}
      </p>
      <p>
        <Link className="button" to="/">
          {t('access.goHome')}
        </Link>
      </p>
    </section>
  );
}
