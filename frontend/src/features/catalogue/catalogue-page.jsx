import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  useGetCatalogue,
  useGetCatalogueId,
} from '../../api/generated/default/default';
import QueryState from '../../shared/ui/entity/query-state.jsx';
import SearchBar from '../../shared/ui/entity/search-bar.jsx';
import { useEntityParams } from '../../shared/ui/entity/use-entity-params.js';
import { formatPrice } from '../products/use-product-references.js';
import CatalogueDetail, { CatalogueAllergens } from './catalogue-detail.jsx';
import '../../shared/ui/entity/entity.css';

function categoriesOf(items) {
  const byId = new Map();
  items.forEach((item) => {
    if (item.category?.id) byId.set(item.category.id, item.category.name);
  });
  return [...byId].sort((a, b) => a[1].localeCompare(b[1]));
}

export default function CataloguePage() {
  const { t, i18n } = useTranslation();
  const { q, id, search, view, close, reset } = useEntityParams();
  const [params, setParams] = useSearchParams();
  const categoryId = params.get('categoryId') ?? '';

  const query = {};
  if (q) query.search = q;
  if (categoryId) query.categoryId = categoryId;
  const filtered = Object.keys(query).length > 0;

  const all = useGetCatalogue();
  const list = useGetCatalogue(filtered ? query : undefined);
  const detail = useGetCatalogueId(id, { query: { enabled: Boolean(id) } });
  const items = [...(list.data ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const setCategory = (value) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set('categoryId', value);
      else next.delete('categoryId');
      next.delete('id');
      return next;
    });

  return (
    <div className="entity-page">
      <header className="entity-header">
        <h1>{t('catalogue.title')}</h1>
      </header>

      {id ? (
        <QueryState
          query={detail}
          unavailableText={t('catalogue.unavailable')}
          unavailableAction={
            <button type="button" className="secondary small" onClick={reset}>
              {t('catalogue.backToCatalogue')}
            </button>
          }
        >
          {detail.data && (
            <CatalogueDetail item={detail.data} onClose={close} />
          )}
        </QueryState>
      ) : (
        <>
          <p>{t('catalogue.intro')}</p>
          <SearchBar
            value={q}
            onSearch={search}
            label={t('catalogue.searchLabel')}
            hint={t('catalogue.searchHint')}
          />
          <div className="entity-search">
            <div>
              <label htmlFor="catalogue-category">
                {t('catalogue.category')}
              </label>
              <select
                id="catalogue-category"
                value={categoryId}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="">{t('catalogue.allCategories')}</option>
                {categoriesOf(all.data ?? []).map(([value, name]) => (
                  <option key={value} value={value}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <QueryState
            query={list}
            isEmpty={items.length === 0}
            searchTerm={filtered ? q || '*' : ''}
            emptyText={t('catalogue.empty')}
            noResultsText={t('catalogue.noResults')}
          >
            <ul className="entity-grid">
              {items.map((item) => (
                <li key={item.id}>
                  <article className="entity-card">
                    <h2>{item.name}</h2>
                    <p className="entity-hint">{item.category?.name}</p>
                    <p>{item.description}</p>
                    <p>
                      <strong>{formatPrice(item.price, i18n.language)}</strong>
                    </p>
                    <CatalogueAllergens allergens={item.allergens} />
                    <div className="entity-actions">
                      <button
                        type="button"
                        className="secondary small"
                        onClick={() => view(item.id)}
                        aria-label={`${t('catalogue.view')}: ${item.name}`}
                      >
                        {t('catalogue.view')}
                      </button>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </QueryState>
        </>
      )}
    </div>
  );
}
