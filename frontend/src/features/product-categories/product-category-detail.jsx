import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useDeleteProductCategoriesId,
  useGetProducts,
} from '../../api/generated/default/default.js';
import { invalidateResource } from '../../shared/api/invalidate.js';
import { useCan } from '../../shared/auth/use-can.js';
import { useConfirm } from '../../shared/feedback/use-feedback.js';
import { useSubmit } from '../../shared/forms/use-submit.js';
import QueryState from '../../shared/ui/entity/query-state.jsx';
import { getProductCategoryErrorKey } from './product-categories-errors.js';

export default function ProductCategoryDetail({
  category,
  onEdit,
  onClose,
  onRemoved,
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canWrite = useCan('categories:write');
  const confirm = useConfirm();
  const { submit, submitting, error } = useSubmit();
  const removeCategory = useDeleteProductCategoriesId();
  const products = useGetProducts({ categoryId: category.id });

  const handleRemove = async () => {
    const confirmed = await confirm({
      titleKey: 'productCategories.confirmRemoveTitle',
      messageKey: 'productCategories.confirmRemove',
      params: { name: category.name },
      confirmKey: 'productCategories.remove',
      tone: 'danger',
    });
    if (!confirmed) return;

    const result = await submit(
      () => removeCategory.mutateAsync({ id: category.id }),
      {
        successKey: 'productCategories.removed',
        successParams: { name: category.name },
      }
    );
    if (
      result.ok ||
      result.error?.outcomeUnknown ||
      result.error?.status === 404
    ) {
      await invalidateResource(
        queryClient,
        '/product-categories',
        '/catalogue'
      );
    }
    if (result.ok) {
      onRemoved();
    }
  };

  const errorKey = getProductCategoryErrorKey('remove', error);
  const productList = products.data ?? [];

  return (
    <section className="entity-card" aria-labelledby="product-category-title">
      <h2 id="product-category-title">
        {t('productCategories.detailTitle', { name: category.name })}
      </h2>

      {error && !error.global && (
        <p className="message message-error" role="alert">
          {errorKey ? t(errorKey) : t(`feedback.errors.${error.kind}`)}
        </p>
      )}

      <dl className="entity-fields">
        <dt>{t('productCategories.col.name')}</dt>
        <dd>{category.name}</dd>
        <dt>{t('entity.status')}</dt>
        <dd>
          <span className="entity-badge">{t('entity.active')}</span>
        </dd>
      </dl>

      <h3>{t('productCategories.products')}</h3>
      <QueryState
        query={products}
        isEmpty={productList.length === 0}
        emptyText={t('productCategories.noProducts')}
      >
        <ul>
          {productList.map((product) => (
            <li key={product.id}>
              {product.name}{' '}
              {product.isActive === false && (
                <span className="entity-badge is-inactive">
                  {t('entity.inactive')}
                </span>
              )}
            </li>
          ))}
        </ul>
      </QueryState>

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
              className="danger"
              onClick={handleRemove}
              disabled={submitting}
            >
              {t('productCategories.remove')}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
