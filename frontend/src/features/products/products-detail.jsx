import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetCatalogueId,
  usePatchProductsId,
} from '../../api/generated/default/default';
import { invalidateResource } from '../../shared/api/invalidate.js';
import { useCan } from '../../shared/auth/use-can.js';
import { useConfirm } from '../../shared/feedback/use-feedback.js';
import { useSubmit } from '../../shared/forms/use-submit.js';
import { getProductErrorKey } from './products-errors.js';
import ProductSizeConfigs from '../product-size-configurations/products-size-configs.jsx';
import { formatPrice, useProductReferences } from './use-product-references.js';

function ProductAllergens({ product, refs }) {
  const { t } = useTranslation();
  const ids = product.allergenIds ?? [];
  const fromCatalogue =
    !refs.canReadAllergens &&
    ids.length > 0 &&
    product.sellable &&
    product.isActive !== false;
  const catalogueItem = useGetCatalogueId(product.id, {
    query: { enabled: fromCatalogue },
  });

  if (ids.length === 0) return <p>{t('products.noAllergens')}</p>;

  let names = null;
  if (refs.canReadAllergens) {
    names = ids.map((id) => refs.allergenById.get(id)?.name ?? id);
  } else if (fromCatalogue && catalogueItem.data) {
    names = (catalogueItem.data.allergens ?? []).map((a) => a.name);
  }

  if (!names) {
    if (fromCatalogue && catalogueItem.isPending) {
      return <p role="status">{t('layout.loading')}</p>;
    }
    return (
      <p className="message">
        {t('products.allergensHidden', { count: ids.length })}
      </p>
    );
  }
  return (
    <ul>
      {names.map((name) => (
        <li key={name}>
          <strong>{name}</strong>
        </li>
      ))}
    </ul>
  );
}

export default function ProductDetail({ product, onEdit, onClose }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const canWrite = useCan('products:write');
  const confirm = useConfirm();
  const { submit, submitting, error } = useSubmit();
  const updateProduct = usePatchProductsId();
  const refs = useProductReferences({
    withProducts: Boolean(product.aggregate),
  });
  const active = product.isActive !== false;
  const yesNo = (value) => t(value ? 'products.yes' : 'products.no');

  const handleToggleActive = async () => {
    if (active) {
      const confirmed = await confirm({
        titleKey: 'products.confirmDeactivateTitle',
        messageKey: 'products.confirmDeactivate',
        params: { name: product.name },
        confirmKey: 'products.deactivate',
        tone: 'danger',
      });
      if (!confirmed) return;
    }

    const result = await submit(
      () =>
        updateProduct.mutateAsync({
          id: product.id,
          data: { isActive: !active },
        }),
      {
        successKey: active ? 'products.deactivated' : 'products.activated',
        successParams: { name: product.name },
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
        '/stock',
        '/predefined-pizzas'
      );
    }
  };

  const errorKey = getProductErrorKey(
    active ? 'deactivate' : 'activate',
    error
  );
  const category = refs.categoryById.get(product.categoryId);
  const type = refs.typeById.get(product.pizzaComponentTypeId);
  const aggregate = product.aggregate;

  return (
    <section className="entity-card" aria-labelledby="product-title">
      <h2 id="product-title">
        {t('products.detailTitle', { name: product.name })}
      </h2>

      {error && !error.global && (
        <p className="message message-error" role="alert">
          {errorKey ? t(errorKey) : t(`feedback.errors.${error.kind}`)}
        </p>
      )}
      {!active && (
        <p className="message message-warning">{t('products.inactiveNote')}</p>
      )}

      <h3>{t('products.sections.characteristics')}</h3>
      <dl className="entity-fields">
        <dt>{t('products.fields.description')}</dt>
        <dd>{product.description}</dd>
        <dt>{t('products.fields.category')}</dt>
        <dd>{category?.name ?? t('products.unknownCategory')}</dd>
        <dt>{t('products.fields.sellable')}</dt>
        <dd>{yesNo(product.sellable)}</dd>
        <dt>{t('products.fields.stockControlled')}</dt>
        <dd>{yesNo(product.stockControlled)}</dd>
        <dt>{t('products.fields.pizzaComponent')}</dt>
        <dd>{yesNo(product.pizzaComponentTypeId)}</dd>
        {product.pizzaComponentTypeId && (
          <>
            <dt>{t('products.fields.componentType')}</dt>
            <dd>{type?.name ?? t('products.unknownType')}</dd>
          </>
        )}
        <dt>{t('entity.status')}</dt>
        <dd>
          <span className={`entity-badge${active ? '' : ' is-inactive'}`}>
            {t(active ? 'entity.active' : 'entity.inactive')}
          </span>
        </dd>
      </dl>

      {product.sellable && (
        <>
          <h3>{t('products.sections.commercial')}</h3>
          <dl className="entity-fields">
            <dt>{t('products.fields.price')}</dt>
            <dd>{formatPrice(product.price, i18n.language)}</dd>
          </dl>
        </>
      )}

      <h3>{t('products.sections.allergens')}</h3>
      <ProductAllergens product={product} refs={refs} />

      <h3>{t('products.sections.aggregate')}</h3>
      {!aggregate && <p>{t('products.aggregate.none')}</p>}
      {aggregate && (
        <>
          <dl className="entity-fields">
            <dt>{t('products.fields.classification')}</dt>
            <dd>{t(`products.aggregate.${aggregate.classification}`)}</dd>
          </dl>
          {aggregate.classification === 'PURCHASED' ? (
            <p>{t('products.aggregate.purchasedNote')}</p>
          ) : (
            <div className="entity-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t('products.aggregate.product')}</th>
                    <th scope="col">{t('products.aggregate.quantity')}</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregate.items.map((item) => (
                    <tr key={item.productId}>
                      <td>
                        {refs.productById.get(item.productId)?.name ??
                          t('products.unknownProduct')}
                      </td>
                      <td>{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* BCK08: prices per pizza size, only for pizza components. */}
      {product.pizzaComponentTypeId && <ProductSizeConfigs product={product} />}

      <div className="entity-actions">
        <button type="button" className="secondary" onClick={onClose}>
          {t('entity.backToList')}
        </button>
        {canWrite && (
          <>
            <button
              type="button"
              className="secondary"
              onClick={onEdit}
              disabled={submitting}
            >
              {t('entity.edit')}
            </button>
            <button
              type="button"
              className={active ? 'danger' : undefined}
              onClick={handleToggleActive}
              disabled={submitting}
            >
              {t(active ? 'products.deactivate' : 'products.activate')}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
