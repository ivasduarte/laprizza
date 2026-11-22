import { useTranslation } from 'react-i18next';
import { useGetCustomersMe } from '../../api/generated/default/default';
import QueryState from '../../shared/ui/entity/query-state.jsx';
import { CustomerContacts } from './customers-detail.jsx';
import CustomerForm from './customers-form.jsx';
import { useCan } from '../../shared/auth/use-can.js';
import '../../shared/ui/entity/entity.css';

export default function MyCustomerPage() {
  const { t } = useTranslation();
  const me = useGetCustomersMe();
  const canCreate = useCan('customers:write:own');
  // A Customer account without a customer record creates its own (once).
  const noProfile =
    me.isError && me.error?.status === 404 && me.error?.code === 'CUSTOMER_PROFILE_NOT_FOUND';

  return (
    <div className="entity-page">
      <header className="entity-header">
        <h1>{t('myData.title')}</h1>
      </header>

      {noProfile && canCreate ? (
        <CustomerForm self onSaved={() => me.refetch()} />
      ) : (
      <QueryState query={me} unavailableText={t('myData.noProfile')}>
        {me.data && (
          <section className="entity-card" aria-labelledby="my-data-title">
            <h2 id="my-data-title">{t('myData.contactsTitle')}</h2>
            <CustomerContacts customer={me.data} />
            <p className="entity-hint">{t('myData.readOnly')}</p>
          </section>
        )}
      </QueryState>
      )}
    </div>
  );
}
