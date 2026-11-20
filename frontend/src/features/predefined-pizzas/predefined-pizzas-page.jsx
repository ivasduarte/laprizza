import { useTranslation } from 'react-i18next';
import {
  useGetPredefinedPizzas,
  useGetPredefinedPizzasId,
} from '../../api/generated/default/default';
import { useCan } from '../../shared/auth/use-can.js';
import QueryState from '../../shared/ui/entity/query-state.jsx';
import SearchBar from '../../shared/ui/entity/search-bar.jsx';
import { useEntityParams } from '../../shared/ui/entity/use-entity-params.js';
import PredefinedPizzaDetail from './predefined-pizzas-detail.jsx';
import PredefinedPizzaForm from './predefined-pizzas-form.jsx';
import { usePizzaReferences } from './use-pizza-reference.js';
import '../../shared/ui/entity/entity.css';

export default function PredefinedPizzasPage() {
  const { t } = useTranslation();
  const canWrite = useCan('pizzas:write');
  const { q, id, mode, search, view, create, edit, closeForm, close, reset } =
    useEntityParams();
  const refs = usePizzaReferences();

  const list = useGetPredefinedPizzas(q ? { name: q } : undefined);
  const detail = useGetPredefinedPizzasId(id, {
    query: { enabled: Boolean(id) && mode !== 'new' },
  });

  const pizzas = [...(list.data ?? [])].sort((a, b) =>
    (refs.productById.get(a.productId)?.name ?? '').localeCompare(
      refs.productById.get(b.productId)?.name ?? ''
    )
  );
  const showForm = canWrite && (mode === 'new' || mode === 'edit');
  const panelOpen = Boolean(id) || (showForm && mode === 'new');

  const renderPanel = () => {
    if (showForm && mode === 'new') {
      return (
        <PredefinedPizzaForm
          onSaved={(saved) => view(saved.id)}
          onCancel={closeForm}
        />
      );
    }
    return (
      <QueryState
        query={detail}
        unavailableText={t('predefinedPizzas.unavailable')}
        unavailable={detail.data?.isActive === false}
        unavailableAction={
          <button type="button" className="secondary small" onClick={reset}>
            {t('entity.backToList')}
          </button>
        }
      >
        {showForm ? (
          <PredefinedPizzaForm
            key={detail.data?.id}
            pizza={detail.data}
            onSaved={closeForm}
            onCancel={closeForm}
          />
        ) : (
          detail.data && (
            <PredefinedPizzaDetail
              pizza={detail.data}
              onEdit={() => edit(detail.data.id)}
              onClose={close}
              onDeactivated={reset}
            />
          )
        )}
      </QueryState>
    );
  };

  return (
    <div className="entity-page">
      <header className="entity-header">
        <h1>{t('predefinedPizzas.title')}</h1>
        {canWrite && !panelOpen && (
          <button type="button" onClick={create}>
            {t('predefinedPizzas.create')}
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
            label={t('predefinedPizzas.searchLabel')}
            hint={t('predefinedPizzas.searchHint')}
          />
          <QueryState
            query={list}
            isEmpty={pizzas.length === 0}
            searchTerm={q}
            emptyText={t('predefinedPizzas.empty')}
            noResultsText={t('predefinedPizzas.noResults', { term: q })}
          >
            <div className="entity-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t('predefinedPizzas.col.pizza')}</th>
                    <th scope="col">{t('predefinedPizzas.col.sizes')}</th>
                    <th scope="col">{t('predefinedPizzas.col.components')}</th>
                    <th scope="col">{t('entity.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pizzas.map((pizza) => {
                    const name =
                      refs.productById.get(pizza.productId)?.name ??
                      t('predefinedPizzas.unknownProduct');
                    const componentIds =
                      pizza.defaultConfiguration?.componentIds ?? [];
                    return (
                      <tr key={pizza.id}>
                        <td>{name}</td>
                        <td>
                          {(pizza.sizeIds ?? [])
                            .map((sizeId) => refs.sizeById.get(sizeId)?.name)
                            .filter(Boolean)
                            .join(', ')}
                        </td>
                        <td>
                          {t('predefinedPizzas.componentCount', {
                            count: componentIds.length,
                          })}
                        </td>
                        <td>
                          <div className="entity-actions">
                            <button
                              type="button"
                              className="secondary small"
                              onClick={() => view(pizza.id)}
                              aria-label={`${t('entity.view')}: ${name}`}
                            >
                              {t('entity.view')}
                            </button>
                            {canWrite && (
                              <button
                                type="button"
                                className="secondary small"
                                onClick={() => edit(pizza.id)}
                                aria-label={`${t('entity.edit')}: ${name}`}
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
