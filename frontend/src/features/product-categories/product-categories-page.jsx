import { useTranslation } from 'react-i18next';
import {
  useGetProductCategories,
  useGetProductCategoriesId,
} from '../../api/generated/default/default';
import { useCan } from '../../shared/auth/use-can.js';
import QueryState from '../../shared/ui/entity/query-state.jsx';
import SearchBar from '../../shared/ui/entity/search-bar.jsx';
import { useEntityParams } from '../../shared/ui/entity/use-entity-params.js';
import ProductCategoryDetail from './product-category-detail.jsx';
import ProductCategoryForm from './product-category-form.jsx';
import '../../shared/ui/entity/entity.css';

export default function ProductCategoriesPage() {
  const { t } = useTranslation();
  const canWrite = useCan('categories:write');
  const { q, id, mode, search, view, create, edit, closeForm, close, reset } =
    useEntityParams();

  const list = useGetProductCategories(q ? { name: q } : undefined);
  const detail = useGetProductCategoriesId(id, {
    query: { enabled: Boolean(id) && mode !== 'new' },
  });

  const categories = list.data ?? [];
  const showForm = canWrite && (mode === 'new' || mode === 'edit');
  const unavailableAction = (
    <button type="button" className="secondary small" onClick={reset}>
      {t('entity.backToList')}
    </button>
  );

  const renderPanel = () => {
    if (showForm && mode === 'new') {
      return (
        <ProductCategoryForm
          onSaved={(saved) => view(saved.id)}
          onCancel={closeForm}
        />
      );
    }
    return (
      <QueryState
        query={detail}
        unavailableText={t('productCategories.unavailable')}
        unavailable={detail.data?.isActive === false}
        unavailableAction={unavailableAction}
      >
        {showForm ? (
          <ProductCategoryForm
            key={detail.data?.id}
            category={detail.data}
            onSaved={closeForm}
            onCancel={closeForm}
          />
        ) : (
          detail.data && (
            <ProductCategoryDetail
              category={detail.data}
              onEdit={() => edit(detail.data.id)}
              onClose={close}
              onRemoved={reset}
            />
          )
        )}
      </QueryState>
    );
  };

  const panelOpen = Boolean(id) || (showForm && mode === 'new');

  return (
    <div className="entity-page">
      <header className="entity-header">
        <h1>{t('productCategories.title')}</h1>
        {canWrite && !panelOpen && (
          <button type="button" onClick={create}>
            {t('productCategories.create')}
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
            label={t('productCategories.searchLabel')}
            hint={t('productCategories.searchHint')}
          />
          <QueryState
            query={list}
            isEmpty={categories.length === 0}
            searchTerm={q}
            emptyText={t('productCategories.empty')}
            noResultsText={t('productCategories.noResults', { term: q })}
          >
            <div className="entity-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t('productCategories.col.name')}</th>
                    <th scope="col">{t('entity.status')}</th>
                    <th scope="col">{t('entity.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => {
                    const active = category.isActive !== false;
                    return (
                      <tr
                        key={category.id}
                        className={active ? undefined : 'is-inactive'}
                      >
                        <td>{category.name}</td>
                        <td>
                          <span
                            className={`entity-badge${active ? '' : ' is-inactive'}`}
                          >
                            {t(active ? 'entity.active' : 'entity.inactive')}
                          </span>
                        </td>
                        <td>
                          {/* Removed categories have no detail or actions (BCK03). */}
                          {active && (
                            <div className="entity-actions">
                              <button
                                type="button"
                                className="secondary small"
                                onClick={() => view(category.id)}
                                aria-label={`${t('entity.view')}: ${category.name}`}
                              >
                                {t('entity.view')}
                              </button>
                              {canWrite && (
                                <button
                                  type="button"
                                  className="secondary small"
                                  onClick={() => edit(category.id)}
                                  aria-label={`${t('entity.edit')}: ${category.name}`}
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
