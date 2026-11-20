import { useTranslation } from 'react-i18next';
import { useGetCustomersMe } from '../../api/generated/default/default';
import QueryState from '../../shared/ui/entity/query-state.jsx';
import { CustomerContacts } from './customers-detail.jsx';
import '../../shared/ui/entity/entity.css';

export default function MyCustomerPage() {
  const { t } = useTranslation();
  const me = useGetCustomersMe();

  return (
    <div className="entity-page">
      <header className="entity-header">
        <h1>{t('myData.title')}</h1>
      </header>

      <QueryState query={me} unavailableText={t('myData.noProfile')}>
        {me.data && (
          <section className="entity-card" aria-labelledby="my-data-title">
            <h2 id="my-data-title">{t('myData.contactsTitle')}</h2>
            <CustomerContacts customer={me.data} />
            <p className="entity-hint">{t('myData.readOnly')}</p>
          </section>
        )}
      </QueryState>
    </div>
  );
}
