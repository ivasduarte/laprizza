import { useTranslation } from 'react-i18next';
import Spinner from './spinner.jsx';

/**
 * Loading placeholder with reserved space (WEB02: the layout must not grow when the data
 * arrives). `page` fills the content area while a page or the session loads; `region`
 * keeps the room of a list or detail block.
 *
 * @param {{variant?: 'page'|'region'}} props
 */
export default function Loading({ variant = 'region' }) {
  const { t } = useTranslation();
  return (
    <p role="status" className={`loading-placeholder loading-${variant}`}>
      <Spinner />
      {t('layout.loading')}
    </p>
  );
}
