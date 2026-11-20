import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useDeleteProductsProductIdSizeConfigurationsSizeId,
  useGetPizzaSize,
  useGetProductsProductIdSizeConfigurations,
} from '../../api/generated/default/default';
import { invalidateResource } from '../../shared/api/invalidate.js';
import { useCan } from '../../shared/auth/use-can.js';
import { useConfirm } from '../../shared/feedback/use-feedback.js';
import { useSubmit } from '../../shared/forms/use-submit.js';
import QueryState from '../../shared/ui/entity/query-state.jsx';
import ProductSizeConfigForm from './products-size-config-form.jsx';
import { getSizeConfigErrorKey } from '../products/products-errors.js';
import { formatPrice } from '../products/use-product-references.js';

export default function ProductSizeConfigs({ product }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const canWrite = useCan('pizzas:write');
  const confirm = useConfirm();
  const { submit, submitting, error } = useSubmit();
  const removeConfig = useDeleteProductsProductIdSizeConfigurationsSizeId();
  const configs = useGetProductsProductIdSizeConfigurations(product.id);
  const sizes = useGetPizzaSize();
  const [editingSizeId, setEditingSizeId] = useState(null);

  const productActive = product.isActive !== false;
  const withUnits = Boolean(product.stockControlled);
  const columns = withUnits ? 4 : 3;
  const configBySize = new Map(
    (configs.data ?? []).map((config) => [config.pizzaSizeId, config])
  );
  const rows = (sizes.data ?? []).filter(
    (size) => size.isActive !== false || configBySize.has(size.id)
  );

  const handleRemove = async (size) => {
    const confirmed = await confirm({
      titleKey: 'products.sizeConfigs.confirmRemoveTitle',
      messageKey: 'products.sizeConfigs.confirmRemove',
      params: { size: size.name },
      confirmKey: 'products.sizeConfigs.remove',
      tone: 'danger',
    });
    if (!confirmed) return;

    const result = await submit(
      () =>
        removeConfig.mutateAsync({ productId: product.id, sizeId: size.id }),
      {
        successKey: 'products.sizeConfigs.removed',
        successParams: { size: size.name },
      }
    );
    if (
      result.ok ||
      result.error?.outcomeUnknown ||
      result.error?.status === 404
    ) {
      await invalidateResource(
        queryClient,
        '/products',
        '/catalogue',
        '/predefined-pizzas'
      );
    }
  };

  const errorKey = getSizeConfigErrorKey('remove', error);

  const actionsFor = (size, config) => {
    if (!canWrite) return null;
    const busy = submitting || editingSizeId !== null;
    if (config) {
      return (
        <div className="entity-actions">
          {productActive && (
            <button
              type="button"
              className="secondary small"
              onClick={() => setEditingSizeId(size.id)}
              disabled={busy}
            >
              {t('products.sizeConfigs.edit')}
            </button>
          )}
          <button
            type="button"
            className="danger small"
            onClick={() => handleRemove(size)}
            disabled={busy}
          >
            {t('products.sizeConfigs.remove')}
          </button>
        </div>
      );
    }
    if (productActive && size.isActive !== false) {
      return (
        <button
          type="button"
          className="secondary small"
          onClick={() => setEditingSizeId(size.id)}
          disabled={busy}
        >
          {t('products.sizeConfigs.configure')}
        </button>
      );
    }
    return null;
  };

  return (
    <section aria-labelledby="product-size-configs-title">
      <h3 id="product-size-configs-title">{t('products.sizeConfigs.title')}</h3>
      <p className="entity-hint">{t('products.sizeConfigs.intro')}</p>
      {!productActive && canWrite && (
        <p className="message message-warning">
          {t('products.sizeConfigs.inactiveProduct')}
        </p>
      )}
      {error && !error.global && (
        <p className="message message-error" role="alert">
          {errorKey ? t(errorKey) : t(`feedback.errors.${error.kind}`)}
        </p>
      )}

      <QueryState query={sizes}>
        <QueryState
          query={configs}
          isEmpty={rows.length === 0}
          emptyText={t('products.sizeConfigs.noSizes')}
        >
          <div className="entity-table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('products.sizeConfigs.size')}</th>
                  <th scope="col">{t('products.sizeConfigs.price')}</th>
                  {withUnits && (
                    <th scope="col">{t('products.sizeConfigs.stockUnits')}</th>
                  )}
                  <th scope="col">{t('entity.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((size) => {
                  const config = configBySize.get(size.id) ?? null;
                  const sizeActive = size.isActive !== false;
                  const sizeCell = (
                    <th scope="row">
                      {size.name}{' '}
                      {!sizeActive && (
                        <span className="entity-badge is-inactive">
                          {t('entity.inactive')}
                        </span>
                      )}
                    </th>
                  );

                  if (editingSizeId === size.id) {
                    return (
                      <tr key={size.id} className="is-selected">
                        {sizeCell}
                        <td colSpan={columns - 1}>
                          <ProductSizeConfigForm
                            product={product}
                            size={size}
                            config={config}
                            onDone={() => setEditingSizeId(null)}
                            onCancel={() => setEditingSizeId(null)}
                          />
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr
                      key={size.id}
                      className={sizeActive ? undefined : 'is-inactive'}
                    >
                      {sizeCell}
                      <td>
                        {config ? (
                          formatPrice(config.price, i18n.language)
                        ) : (
                          <em>{t('products.sizeConfigs.notConfigured')}</em>
                        )}
                      </td>
                      {withUnits && (
                        <td>{config?.stockUnitsConsumed ?? '—'}</td>
                      )}
                      <td>{actionsFor(size, config)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </QueryState>
      </QueryState>
    </section>
  );
}
