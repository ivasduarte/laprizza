import { useTranslation } from 'react-i18next';
import {
  useGetPizzaComponentType,
  useGetPizzaComponentTypeId,
} from '../../api/generated/default/default';
import { useCan } from '../../shared/auth/use-can.js';
import QueryState from '../../shared/ui/entity/query-state.jsx';
import SearchBar from '../../shared/ui/entity/search-bar.jsx';
import { useEntityParams } from '../../shared/ui/entity/use-entity-params.js';
import PizzaComponentTypeDetail from './pizza-component-types-detail.jsx';
import PizzaComponentTypeForm from './pizza-component-types-form.jsx';
import '../../shared/ui/entity/entity.css';

const byAssemblyOrder = (a, b) => a.assemblyOrder - b.assemblyOrder;

export default function PizzaComponentTypesPage() {
  const { t } = useTranslation();
  const canWrite = useCan('pizzas:write');
  const { q, id, mode, search, view, create, edit, closeForm, close, reset } =
    useEntityParams();

  const list = useGetPizzaComponentType(q ? { name: q } : undefined);
  const detail = useGetPizzaComponentTypeId(id, {
    query: { enabled: Boolean(id) && mode !== 'new' },
  });

  // The API already sorts the full list; a search result is sorted here too.
  const types = [...(list.data ?? [])].sort(byAssemblyOrder);
  const showForm = canWrite && (mode === 'new' || mode === 'edit');
  const panelOpen = Boolean(id) || (showForm && mode === 'new');
  const maxText = (type) =>
    type.maxQuantity === null || type.maxQuantity === undefined
      ? t('pizzaComponentTypes.unlimited')
      : type.maxQuantity;

  const renderPanel = () => {
    if (showForm && mode === 'new') {
      return (
        <PizzaComponentTypeForm
          onSaved={(saved) => view(saved.id)}
          onCancel={closeForm}
        />
      );
    }
    return (
      <QueryState
        query={detail}
        unavailableText={t('pizzaComponentTypes.unavailable')}
        unavailable={detail.data?.isActive === false}
        unavailableAction={
          <button type="button" className="secondary small" onClick={reset}>
            {t('entity.backToList')}
          </button>
        }
      >
        {showForm ? (
          <PizzaComponentTypeForm
            key={detail.data?.id}
            type={detail.data}
            onSaved={closeForm}
            onCancel={closeForm}
          />
        ) : (
          detail.data && (
            <PizzaComponentTypeDetail
              type={detail.data}
              onEdit={() => edit(detail.data.id)}
              onClose={close}
              onRemoved={reset}
            />
          )
        )}
      </QueryState>
    );
  };

  return (
    <div className="entity-page">
      <header className="entity-header">
        <h1>{t('pizzaComponentTypes.title')}</h1>
        {canWrite && !panelOpen && (
          <button type="button" onClick={create}>
            {t('pizzaComponentTypes.create')}
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
            label={t('pizzaComponentTypes.searchLabel')}
            hint={t('pizzaComponentTypes.searchHint')}
          />
          <QueryState
            query={list}
            isEmpty={types.length === 0}
            searchTerm={q}
            emptyText={t('pizzaComponentTypes.empty')}
            noResultsText={t('pizzaComponentTypes.noResults', { term: q })}
          >
            <div className="entity-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">
                      {t('pizzaComponentTypes.col.assemblyOrder')}
                    </th>
                    <th scope="col">{t('pizzaComponentTypes.col.name')}</th>
                    <th scope="col">
                      {t('pizzaComponentTypes.col.minQuantity')}
                    </th>
                    <th scope="col">
                      {t('pizzaComponentTypes.col.maxQuantity')}
                    </th>
                    <th scope="col">{t('entity.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {types.map((type) => {
                    const active = type.isActive !== false;
                    return (
                      <tr
                        key={type.id}
                        className={active ? undefined : 'is-inactive'}
                      >
                        <td>{type.assemblyOrder}</td>
                        <td>
                          {type.name}{' '}
                          {!active && (
                            <span className="entity-badge is-inactive">
                              {t('entity.inactive')}
                            </span>
                          )}
                        </td>
                        <td>{type.minQuantity}</td>
                        <td>{maxText(type)}</td>
                        <td>
                          {/* Removed types have no detail or actions (BCK07). */}
                          {active && (
                            <div className="entity-actions">
                              <button
                                type="button"
                                className="secondary small"
                                onClick={() => view(type.id)}
                                aria-label={`${t('entity.view')}: ${type.name}`}
                              >
                                {t('entity.view')}
                              </button>
                              {canWrite && (
                                <button
                                  type="button"
                                  className="secondary small"
                                  onClick={() => edit(type.id)}
                                  aria-label={`${t('entity.edit')}: ${type.name}`}
                                >
                                  {t('entity.edit')}
                                </button>
                              )}
                            </div>
                          )}
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
