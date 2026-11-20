import { useTranslation } from 'react-i18next';
import {
  useGetPizzaSize,
  useGetPizzaSizeId,
} from '../../api/generated/default/default';
import { useCan } from '../../shared/auth/use-can.js';
import QueryState from '../../shared/ui/entity/query-state.jsx';
import SearchBar from '../../shared/ui/entity/search-bar.jsx';
import { useEntityParams } from '../../shared/ui/entity/use-entity-params.js';
import PizzaSizeDetail from './pizza-sizes-detail.jsx';
import PizzaSizeForm from './pizza-sizes-form.jsx';
import '../../shared/ui/entity/entity.css';

export default function PizzaSizesPage() {
  const { t } = useTranslation();
  const canWrite = useCan('pizzas:write');
  const { q, id, mode, search, view, create, edit, closeForm, close, reset } =
    useEntityParams();

  const list = useGetPizzaSize(q ? { search: q } : undefined);
  const detail = useGetPizzaSizeId(id, {
    query: { enabled: Boolean(id) && mode !== 'new' },
  });

  const sizes = list.data ?? [];
  const showForm = canWrite && (mode === 'new' || mode === 'edit');
  const panelOpen = Boolean(id) || (showForm && mode === 'new');

  const renderPanel = () => {
    if (showForm && mode === 'new') {
      return (
        <PizzaSizeForm
          onSaved={(saved) => view(saved.id)}
          onCancel={closeForm}
        />
      );
    }
    return (
      <QueryState
        query={detail}
        unavailableText={t('pizzaSizes.unavailable')}
        unavailableAction={
          <button type="button" className="secondary small" onClick={reset}>
            {t('entity.backToList')}
          </button>
        }
      >
        {showForm ? (
          <PizzaSizeForm
            key={detail.data?.id}
            size={detail.data}
            onSaved={closeForm}
            onCancel={closeForm}
          />
        ) : (
          detail.data && (
            <PizzaSizeDetail
              size={detail.data}
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
        <h1>{t('pizzaSizes.title')}</h1>
        {canWrite && !panelOpen && (
          <button type="button" onClick={create}>
            {t('pizzaSizes.create')}
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
            label={t('pizzaSizes.searchLabel')}
            hint={t('pizzaSizes.searchHint')}
          />
          <QueryState
            query={list}
            isEmpty={sizes.length === 0}
            searchTerm={q}
            emptyText={t('pizzaSizes.empty')}
            noResultsText={t('pizzaSizes.noResults', { term: q })}
          >
            <div className="entity-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t('pizzaSizes.col.name')}</th>
                    <th scope="col">{t('entity.status')}</th>
                    <th scope="col">{t('entity.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sizes.map((size) => {
                    const active = size.isActive !== false;
                    return (
                      <tr
                        key={size.id}
                        className={active ? undefined : 'is-inactive'}
                      >
                        <td>{size.name}</td>
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
                              onClick={() => view(size.id)}
                              aria-label={`${t('entity.view')}: ${size.name}`}
                            >
                              {t('entity.view')}
                            </button>
                            {canWrite && (
                              <button
                                type="button"
                                className="secondary small"
                                onClick={() => edit(size.id)}
                                aria-label={`${t('entity.edit')}: ${size.name}`}
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
