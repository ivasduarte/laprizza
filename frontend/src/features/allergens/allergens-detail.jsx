import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { usePutAllergensId } from '../../api/generated/default/default';
import { invalidateResource } from '../../shared/api/invalidate.js';
import { useCan } from '../../shared/auth/use-can.js';
import { useConfirm } from '../../shared/feedback/use-feedback.js';
import { useSubmit } from '../../shared/forms/use-submit.js';
import { getAllergenErrorKey } from './allergens-errors.js';

export default function AllergenDetail({ allergen, onClose, onDeactivated }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canWrite = useCan('allergens:write');
  const confirm = useConfirm();
  const { submit, submitting, error } = useSubmit();
  const deactivateAllergen = usePutAllergensId();

  const handleDeactivate = async () => {
    const confirmed = await confirm({
      titleKey: 'allergens.confirmDeactivateTitle',
      messageKey: 'allergens.confirmDeactivate',
      params: { name: allergen.name },
      confirmKey: 'allergens.deactivate',
      tone: 'danger',
    });
    if (!confirmed) return;

    const result = await submit(
      () =>
        deactivateAllergen.mutateAsync({
          id: allergen.id,
          data: { isActive: false },
        }),
      {
        successKey: 'allergens.deactivated',
        successParams: { name: allergen.name },
      }
    );
    if (
      result.ok ||
      result.error?.outcomeUnknown ||
      result.error?.status === 404
    ) {
      await invalidateResource(queryClient, '/allergens', '/catalogue');
    }
    if (result.ok) {
      onDeactivated();
    }
  };

  const errorKey = getAllergenErrorKey('deactivate', error);

  return (
    <section className="entity-card" aria-labelledby="allergen-title">
      <h2 id="allergen-title">
        {t('allergens.detailTitle', { name: allergen.name })}
      </h2>

      {error && !error.global && (
        <p className="message message-error" role="alert">
          {errorKey ? t(errorKey) : t(`feedback.errors.${error.kind}`)}
        </p>
      )}

      <dl className="entity-fields">
        <dt>{t('allergens.col.name')}</dt>
        <dd>{allergen.name}</dd>
        <dt>{t('entity.status')}</dt>
        <dd>
          <span className="entity-badge">{t('entity.active')}</span>
        </dd>
      </dl>
      {canWrite && <p className="entity-hint">{t('allergens.noEdit')}</p>}

      <div className="entity-actions">
        <button type="button" className="secondary" onClick={onClose}>
          {t('entity.backToList')}
        </button>
        {canWrite && (
          <button
            type="button"
            className="danger"
            onClick={handleDeactivate}
            disabled={submitting}
          >
            {t('allergens.deactivate')}
          </button>
        )}
      </div>
    </section>
  );
}
