import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useGetStock } from '../../api/generated/default/default';
import { useCan } from '../../shared/auth/use-can.js';
import QueryState from '../../shared/ui/entity/query-state.jsx';
import SearchBar from '../../shared/ui/entity/search-bar.jsx';
import { useEntityParams } from '../../shared/ui/entity/use-entity-params.js';
import StockAdjustForm from './stock-adjust-form.jsx';
import '../../shared/ui/entity/entity.css';

const byProductName = (a, b) =>
  (a.product?.name ?? '').localeCompare(b.product?.name ?? '');

export default function StockPage() {
  const { t } = useTranslation();
  const canWrite = useCan('stock:write');
  const canSeeInactive = useCan('stock:read:inactive');
  const { q, search } = useEntityParams();
  const [params, setParams] = useSearchParams();
  const includeInactive = canSeeInactive && params.get('inactive') === '1';
  const [editing, setEditing] = useState(null); // { productId, operation }

  const query = {};
  if (q) query.search = q;
  if (includeInactive) query.includeInactive = true;
  const list = useGetStock(Object.keys(query).length > 0 ? query : undefined);
  const stocks = [...(list.data ?? [])].sort(byProductName);

  const toggleInactive = (checked) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (checked) next.set('inactive', '1');
      else next.delete('inactive');
      return next;
    });

  return (
    <div className="entity-page">
      <header className="entity-header">
        <h1>{t('stock.title')}</h1>
      </header>
      <p>{t('stock.intro')}</p>
      {!canWrite && <p className="message">{t('entity.readOnly')}</p>}

      <SearchBar
        value={q}
        onSearch={search}
        label={t('stock.searchLabel')}
        hint={t('stock.searchHint')}
      />
      {canSeeInactive && (
        <label>
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(event) => toggleInactive(event.target.checked)}
          />{' '}
          {t('stock.includeInactive')}
        </label>
      )}

      <QueryState
        query={list}
        isEmpty={stocks.length === 0}
        searchTerm={q}
        emptyText={t('stock.empty')}
        noResultsText={t('stock.noResults', { term: q })}
      >
        <div className="entity-table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('stock.col.product')}</th>
                <th scope="col">{t('stock.col.quantity')}</th>
                <th scope="col">{t('entity.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((stock) => {
                const name = stock.product?.name ?? stock.productId;
                const active = stock.product?.isActive !== false;
                const isEditing = editing?.productId === stock.productId;
                return (
                  <tr
                    key={stock.productId}
                    className={
                      isEditing
                        ? 'is-selected'
                        : active
                          ? undefined
                          : 'is-inactive'
                    }
                  >
                    <th scope="row">
                      {name}{' '}
                      {!active && (
                        <span className="entity-badge is-inactive">
                          {t('entity.inactive')}
                        </span>
                      )}
                    </th>
                    <td>
                      <strong>{stock.quantity}</strong>
                    </td>
                    <td>
                      {isEditing ? (
                        <StockAdjustForm
                          stock={stock}
                          operation={editing.operation}
                          onDone={() => setEditing(null)}
                          onCancel={() => setEditing(null)}
                        />
                      ) : (
                        <div className="entity-actions">
                          <Link
                            className="button secondary small"
                            to={`/products?id=${stock.productId}`}
                            aria-label={`${t('stock.viewProduct')}: ${name}`}
                          >
                            {t('stock.viewProduct')}
                          </Link>
                          {canWrite && (
                            <>
                              <button
                                type="button"
                                className="secondary small"
                                onClick={() =>
                                  setEditing({
                                    productId: stock.productId,
                                    operation: 'increase',
                                  })
                                }
                                disabled={editing !== null}
                                aria-label={`${t('stock.increase')}: ${name}`}
                              >
                                {t('stock.increase')}
                              </button>
                              <button
                                type="button"
                                className="secondary small"
                                onClick={() =>
                                  setEditing({
                                    productId: stock.productId,
                                    operation: 'decrease',
                                  })
                                }
                                disabled={editing !== null}
                                aria-label={`${t('stock.decrease')}: ${name}`}
                              >
                                {t('stock.decrease')}
                              </button>
                            </>
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
    </div>
  );
}
