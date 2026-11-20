import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { usePatchPizzaSizeId } from '../../api/generated/default/default';
import { invalidateResource } from '../../shared/api/invalidate.js';
import { useCan } from '../../shared/auth/use-can.js';
import { useConfirm } from '../../shared/feedback/use-feedback.js';
import { useSubmit } from '../../shared/forms/use-submit.js';
import { getPizzaSizeErrorKey } from './pizza-sizes-errors.js';

export default function PizzaSizeDetail({ size, onEdit, onClose }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canWrite = useCan('pizzas:write');
  const confirm = useConfirm();
  const { submit, submitting, error } = useSubmit();
  const updateSize = usePatchPizzaSizeId();
  const active = size.isActive !== false;
  const action = active ? 'deactivate' : 'activate';

  const handleToggleActive = async () => {
    if (active) {
      const confirmed = await confirm({
        titleKey: 'pizzaSizes.confirmDeactivateTitle',
        messageKey: 'pizzaSizes.confirmDeactivate',
        params: { name: size.name },
        confirmKey: 'pizzaSizes.deactivate',
        tone: 'danger',
      });
      if (!confirmed) return;
    }

    const result = await submit(
      () =>
        updateSize.mutateAsync({
          id: size.id,
          data: { isActive: !active },
        }),
      {
        successKey: active ? 'pizzaSizes.deactivated' : 'pizzaSizes.activated',
        successParams: { name: size.name },
      }
    );
    if (
      result.ok ||
      result.error?.outcomeUnknown ||
      result.error?.status === 404
    ) {
      await invalidateResource(
        queryClient,
        '/pizza-size',
        '/catalogue',
        '/predefined-pizzas'
      );
    }
  };

  const errorKey = getPizzaSizeErrorKey(action, error);

  return (
    <section className="entity-card" aria-labelledby="pizza-size-title">
      <h2 id="pizza-size-title">
        {t('pizzaSizes.detailTitle', { name: size.name })}
      </h2>

      {error && !error.global && (
        <p className="message message-error" role="alert">
          {errorKey ? t(errorKey) : t(`feedback.errors.${error.kind}`)}
        </p>
      )}
      {!active && (
        <p className="message message-warning">
          {t('pizzaSizes.inactiveNote')}
        </p>
      )}

      <dl className="entity-fields">
        <dt>{t('pizzaSizes.col.name')}</dt>
        <dd>{size.name}</dd>
        <dt>{t('entity.status')}</dt>
        <dd>
          <span className={`entity-badge${active ? '' : ' is-inactive'}`}>
            {t(active ? 'entity.active' : 'entity.inactive')}
          </span>
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
              className={active ? 'danger' : undefined}
              onClick={handleToggleActive}
              disabled={submitting}
            >
              {t(active ? 'pizzaSizes.deactivate' : 'pizzaSizes.activate')}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
