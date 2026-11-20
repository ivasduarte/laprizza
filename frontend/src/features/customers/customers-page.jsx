import { useTranslation } from 'react-i18next';
import {
  useGetCustomers,
  useGetCustomersId,
} from '../../api/generated/default/default';
import { useCan } from '../../shared/auth/use-can.js';
import QueryState from '../../shared/ui/entity/query-state.jsx';
import SearchBar from '../../shared/ui/entity/search-bar.jsx';
import { useEntityParams } from '../../shared/ui/entity/use-entity-params.js';
import CustomerDetail from './customers-detail.jsx';
import CustomerForm from './customers-form.jsx';
import '../../shared/ui/entity/entity.css';

export default function CustomersPage() {
  const { t } = useTranslation();
  const canWrite = useCan('customers:write');
  const { q, id, mode, search, view, create, edit, closeForm, close, reset } =
    useEntityParams();

  const list = useGetCustomers(q ? { search: q } : undefined);
  const detail = useGetCustomersId(id, {
    query: { enabled: Boolean(id) && mode !== 'new' },
  });

  const customers = [...(list.data ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const showForm = canWrite && (mode === 'new' || mode === 'edit');
  const panelOpen = Boolean(id) || (showForm && mode === 'new');

  const renderPanel = () => {
    if (showForm && mode === 'new') {
      return (
        <CustomerForm
          onSaved={(saved) => view(saved.id)}
          onCancel={closeForm}
        />
      );
    }
    return (
      <QueryState
        query={detail}
        unavailableText={t('customers.unavailable')}
        unavailableAction={
          <button type="button" className="secondary small" onClick={reset}>
            {t('entity.backToList')}
          </button>
        }
      >
        {showForm ? (
          <CustomerForm
            key={detail.data?.id}
            customer={detail.data}
            onSaved={closeForm}
            onCancel={closeForm}
          />
        ) : (
          detail.data && (
            <CustomerDetail
              customer={detail.data}
              onEdit={() => edit(detail.data.id)}
              onClose={close}
            />
          )
        )}
      </QueryState>
    );
  };

  return (
    <div className="entity-page">
      <header className="entity-header">
        <h1>{t('customers.title')}</h1>
        {canWrite && !panelOpen && (
          <button type="button" onClick={create}>
            {t('customers.create')}
          </button>
        )}
      </header>

      {!canWrite && <p className="message">{t('entity.readOnly')}</p>}

      {panelOpen ? (
        renderPanel()
      ) : (
        <>
          <SearchBar
            value={q}
            onSearch={search}
            label={t('customers.searchLabel')}
            hint={t('customers.searchHint')}
          />
          <QueryState
            query={list}
            isEmpty={customers.length === 0}
            searchTerm={q}
            emptyText={t('customers.empty')}
            noResultsText={t('customers.noResults', { term: q })}
          >
            <div className="entity-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t('customers.fields.name')}</th>
                    <th scope="col">{t('customers.fields.email')}</th>
                    <th scope="col">{t('customers.fields.phoneNumber')}</th>
                    <th scope="col">{t('customers.fields.city')}</th>
                    <th scope="col">{t('entity.status')}</th>
                    <th scope="col">{t('entity.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => {
                    const active = customer.isActive !== false;
                    return (
                      <tr
                        key={customer.id}
                        className={active ? undefined : 'is-inactive'}
                      >
                        <td>{customer.name}</td>
                        <td>{customer.email}</td>
                        <td>{customer.phoneNumber}</td>
                        <td>{customer.address?.city}</td>
                        <td>
                          <span
                            className={`entity-badge${active ? '' : ' is-inactive'}`}
                          >
                            {t(active ? 'entity.active' : 'entity.inactive')}
                          </span>
                        </td>
                        <td>
                          <div className="entity-actions">
                            <button
                              type="button"
                              className="secondary small"
                              onClick={() => view(customer.id)}
                              aria-label={`${t('entity.view')}: ${customer.name}`}
                            >
                              {t('entity.view')}
                            </button>
                            {canWrite && (
                              <button
                                type="button"
                                className="secondary small"
                                onClick={() => edit(customer.id)}
                                aria-label={`${t('entity.edit')}: ${customer.name}`}
                              >
                                {t('entity.edit')}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </QueryState>
        </>
      )}
    </div>
  );
}
