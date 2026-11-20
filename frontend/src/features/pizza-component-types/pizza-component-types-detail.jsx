import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useDeletePizzaComponentTypeId } from '../../api/generated/default/default';
import { invalidateResource } from '../../shared/api/invalidate.js';
import { useCan } from '../../shared/auth/use-can.js';
import { useConfirm } from '../../shared/feedback/use-feedback.js';
import { useSubmit } from '../../shared/forms/use-submit.js';
import { getPizzaComponentTypeErrorKey } from './pizza-component-types-errors.js';

export default function PizzaComponentTypeDetail({
  type,
  onEdit,
  onClose,
  onRemoved,
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canWrite = useCan('pizzas:write');
  const confirm = useConfirm();
  const { submit, submitting, error } = useSubmit();
  const removeType = useDeletePizzaComponentTypeId();

  const handleRemove = async () => {
    const confirmed = await confirm({
      titleKey: 'pizzaComponentTypes.confirmRemoveTitle',
      messageKey: 'pizzaComponentTypes.confirmRemove',
      params: { name: type.name },
      confirmKey: 'pizzaComponentTypes.remove',
      tone: 'danger',
    });
    if (!confirmed) return;

    const result = await submit(() => removeType.mutateAsync({ id: type.id }), {
      successKey: 'pizzaComponentTypes.removed',
      successParams: { name: type.name },
    });
    if (
      result.ok ||
      result.error?.outcomeUnknown ||
      result.error?.status === 404
    ) {
      await invalidateResource(
        queryClient,
        '/pizza-component-type',
        '/predefined-pizzas'
      );
    }
    if (result.ok) {
      onRemoved();
    }
  };

  const errorKey = getPizzaComponentTypeErrorKey('remove', error);

  return (
    <section
      className="entity-card"
      aria-labelledby="pizza-component-type-title"
    >
      <h2 id="pizza-component-type-title">
        {t('pizzaComponentTypes.detailTitle', { name: type.name })}
      </h2>

      {error && !error.global && (
        <p className="message message-error" role="alert">
          {errorKey ? t(errorKey) : t(`feedback.errors.${error.kind}`)}
        </p>
      )}

      <dl className="entity-fields">
        <dt>{t('pizzaComponentTypes.col.name')}</dt>
        <dd>{type.name}</dd>
        <dt>{t('pizzaComponentTypes.form.assemblyOrder')}</dt>
        <dd>{type.assemblyOrder}</dd>
        <dt>{t('pizzaComponentTypes.form.minQuantity')}</dt>
        <dd>{type.minQuantity}</dd>
        <dt>{t('pizzaComponentTypes.form.maxQuantity')}</dt>
        <dd>
          {type.maxQuantity === null || type.maxQuantity === undefined
            ? t('pizzaComponentTypes.unlimited')
            : type.maxQuantity}
        </dd>
        <dt>{t('entity.status')}</dt>
        <dd>
          <span className="entity-badge">{t('entity.active')}</span>
        </dd>
      </dl>

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
              {t('pizzaComponentTypes.remove')}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
