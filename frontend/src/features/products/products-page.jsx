import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  useGetProducts,
  useGetProductsId,
} from '../../api/generated/default/default';
import { useCan } from '../../shared/auth/use-can.js';
import QueryState from '../../shared/ui/entity/query-state.jsx';
import SearchBar from '../../shared/ui/entity/search-bar.jsx';
import { useEntityParams } from '../../shared/ui/entity/use-entity-params.js';
import ProductDetail from './products-detail.jsx';
import ProductForm from './products-form.jsx';
import { formatPrice, useProductReferences } from './use-product-references.js';
import '../../shared/ui/entity/entity.css';

const BOOLEAN_FILTER = { yes: true, no: false, active: true, inactive: false };

function useProductFilters(q) {
  const [params, setParams] = useSearchParams();
  const filters = {
    categoryId: params.get('categoryId') ?? '',
    sellable: params.get('sellable') ?? '',
    status: params.get('status') ?? '',
  };

  const setFilter = (name, value) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(name, value);
      else next.delete(name);
      next.delete('id');
      next.delete('mode');
      return next;
    });

  const query = {};
  if (q) query.search = q;
  if (filters.categoryId) query.categoryId = filters.categoryId;
  if (filters.sellable in BOOLEAN_FILTER)
    query.sellable = BOOLEAN_FILTER[filters.sellable];
  if (filters.status in BOOLEAN_FILTER)
    query.isActive = BOOLEAN_FILTER[filters.status];

  const filtered = Object.keys(query).length > 0;
  return { filters, setFilter, query: filtered ? query : undefined, filtered };
}

export default function ProductsPage() {
  const { t, i18n } = useTranslation();
  const canWrite = useCan('products:write');
  const { q, id, mode, search, view, create, edit, closeForm, close, reset } =
    useEntityParams();
  const { filters, setFilter, query, filtered } = useProductFilters(q);
  const refs = useProductReferences();

  const list = useGetProducts(query);
  const detail = useGetProductsId(id, {
    query: { enabled: Boolean(id) && mode !== 'new' },
  });

  const products = list.data ?? [];
  const showForm = canWrite && (mode === 'new' || mode === 'edit');
  const panelOpen = Boolean(id) || (showForm && mode === 'new');

  const renderPanel = () => {
    if (showForm && mode === 'new') {
      return (
        <ProductForm onSaved={(saved) => view(saved.id)} onCancel={closeForm} />
      );
    }
    return (
      <QueryState
        query={detail}
        unavailableText={t('products.unavailable')}
        unavailableAction={
          <button type="button" className="secondary small" onClick={reset}>
            {t('entity.backToList')}
          </button>
        }
      >
        {showForm ? (
          <ProductForm
            key={detail.data?.id}
            product={detail.data}
            onSaved={closeForm}
            onCancel={closeForm}
          />
        ) : (
          detail.data && (
            <ProductDetail
              product={detail.data}
              onEdit={() => edit(detail.data.id)}
              onClose={close}
            />
          )
        )}
      </QueryState>
    );
  };

  const selectFilter = (name, labelKey, options) => (
    <div>
      <label htmlFor={`product-filter-${name}`}>{t(labelKey)}</label>
      <select
        id={`product-filter-${name}`}
        value={filters[name]}
        onChange={(event) => setFilter(name, event.target.value)}
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="entity-page">
      <header className="entity-header">
        <h1>{t('products.title')}</h1>
        {canWrite && !panelOpen && (
          <button type="button" onClick={create}>
            {t('products.create')}
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
            label={t('products.searchLabel')}
            hint={t('products.searchHint')}
          />
          <div className="entity-search">
            {selectFilter('categoryId', 'products.filters.category', [
              ['', t('products.filters.allCategories')],
              ...refs.categories.map((category) => [
                category.id,
                category.name,
              ]),
            ])}
            {selectFilter('sellable', 'products.filters.sellable', [
              ['', t('products.filters.all')],
              ['yes', t('products.filters.yes')],
              ['no', t('products.filters.no')],
            ])}
            {selectFilter('status', 'products.filters.status', [
              ['', t('products.filters.all')],
              ['active', t('products.filters.active')],
              ['inactive', t('products.filters.inactive')],
            ])}
          </div>
          <QueryState
            query={list}
            isEmpty={products.length === 0}
            searchTerm={filtered ? q || '*' : ''}
            emptyText={t('products.empty')}
            noResultsText={t('products.noResults')}
          >
            <div className="entity-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t('products.col.name')}</th>
                    <th scope="col">{t('products.col.category')}</th>
                    <th scope="col">{t('products.col.sellable')}</th>
                    <th scope="col">{t('products.col.stock')}</th>
                    <th scope="col">{t('products.col.component')}</th>
                    <th scope="col">{t('entity.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const active = product.isActive !== false;
                    const type = refs.typeById.get(
                      product.pizzaComponentTypeId
                    );
                    return (
                      <tr
                        key={product.id}
                        className={active ? undefined : 'is-inactive'}
                      >
                        <td>
                          {product.name}{' '}
                          {!active && (
                            <span className="entity-badge is-inactive">
                              {t('entity.inactive')}
                            </span>
                          )}
                        </td>
                        <td>
                          {refs.categoryById.get(product.categoryId)?.name ??
                            t('products.unknownCategory')}
                        </td>
                        <td>
                          {product.sellable
                            ? formatPrice(product.price, i18n.language)
                            : t('products.no')}
                        </td>
                        <td>
                          {t(
                            product.stockControlled
                              ? 'products.yes'
                              : 'products.no'
                          )}
                        </td>
                        <td>
                          {product.pizzaComponentTypeId
                            ? (type?.name ?? t('products.unknownType'))
                            : '—'}
                        </td>
                        <td>
                          <div className="entity-actions">
                            <button
                              type="button"
                              className="secondary small"
                              onClick={() => view(product.id)}
                              aria-label={`${t('entity.view')}: ${product.name}`}
                            >
                              {t('entity.view')}
                            </button>
                            {canWrite && (
                              <button
                                type="button"
                                className="secondary small"
                                onClick={() => edit(product.id)}
                                aria-label={`${t('entity.edit')}: ${product.name}`}
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
