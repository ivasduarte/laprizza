import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { usePutPredefinedPizzasId } from '../../api/generated/default/default';
import { invalidateResource } from '../../shared/api/invalidate.js';
import { useCan } from '../../shared/auth/use-can.js';
import { useConfirm } from '../../shared/feedback/use-feedback.js';
import { useSubmit } from '../../shared/forms/use-submit.js';
import { getPredefinedPizzaErrorKey } from './predefined-pizzas-errors.js';
import {
  componentAllergenNames,
  usePizzaReferences,
} from './use-pizza-reference.js';

function groupByType(components) {
  const groups = [];
  components.forEach((component) => {
    const type = component.componentType ?? null;
    const last = groups[groups.length - 1];
    if (last && (last.type?.id ?? null) === (type?.id ?? null)) {
      last.components.push(component);
    } else {
      groups.push({ type, components: [component] });
    }
  });
  return groups;
}

export default function PredefinedPizzaDetail({
  pizza,
  onEdit,
  onClose,
  onDeactivated,
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canWrite = useCan('pizzas:write');
  const confirm = useConfirm();
  const { submit, submitting, error } = useSubmit();
  const updatePizza = usePutPredefinedPizzasId();
  const refs = usePizzaReferences();

  const name = pizza.product?.name ?? '';
  const components = pizza.defaultConfiguration?.components ?? [];
  const allergens = refs.canReadAllergens
    ? componentAllergenNames(
        components.map((c) => c.id),
        refs
      )
    : [];

  const handleDeactivate = async () => {
    const confirmed = await confirm({
      titleKey: 'predefinedPizzas.confirmDeactivateTitle',
      messageKey: 'predefinedPizzas.confirmDeactivate',
      params: { name },
      confirmKey: 'predefinedPizzas.deactivate',
      tone: 'danger',
    });
    if (!confirmed) return;

    const result = await submit(
      () =>
        updatePizza.mutateAsync({ id: pizza.id, data: { isActive: false } }),
      {
        successKey: 'predefinedPizzas.deactivated',
        successParams: { name },
      }
    );
    if (
      result.ok ||
      result.error?.outcomeUnknown ||
      result.error?.status === 404
    ) {
      await invalidateResource(queryClient, '/predefined-pizzas', '/catalogue');
    }
    if (result.ok) {
      onDeactivated();
    }
  };

  const errorKey = getPredefinedPizzaErrorKey('deactivate', error);

  return (
    <section className="entity-card" aria-labelledby="predefined-pizza-title">
      <h2 id="predefined-pizza-title">
        {t('predefinedPizzas.detailTitle', { name })}
      </h2>

      {error && !error.global && (
        <p className="message message-error" role="alert">
          {errorKey ? t(errorKey) : t(`feedback.errors.${error.kind}`)}
        </p>
      )}

      <dl className="entity-fields">
        <dt>{t('predefinedPizzas.fields.product')}</dt>
        <dd>
          {name}{' '}
          <Link
            className="button secondary small"
            to={`/products?id=${pizza.productId}`}
          >
            {t('predefinedPizzas.viewProduct')}
          </Link>
        </dd>
        <dt>{t('predefinedPizzas.fields.sizes')}</dt>
        <dd>
          {(pizza.sizes ?? []).map((size) => size.name).join(', ') || '—'}
        </dd>
      </dl>

      <h3>{t('predefinedPizzas.fields.components')}</h3>
      {components.length === 0 ? (
        <p>{t('predefinedPizzas.noComponents')}</p>
      ) : (
        <dl className="entity-fields">
          {groupByType(components).map(({ type, components: items }) => (
            <div key={type?.id ?? 'none'} style={{ display: 'contents' }}>
              <dt>
                {type
                  ? `${type.assemblyOrder}. ${type.name}`
                  : t('predefinedPizzas.form.otherComponents')}
              </dt>
              <dd>
                {items.map((component, index) => (
                  <span key={component.id}>
                    {index > 0 && ', '}
                    {component.name}
                    {component.isActive === false && (
                      <>
                        {' '}
                        <span className="entity-badge is-inactive">
                          {t('entity.inactive')}
                        </span>
                      </>
                    )}
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {/* Allergens are only shown to users who can read them (MANAGER). */}
      {refs.canReadAllergens && (
        <>
          <h3>{t('predefinedPizzas.fields.allergens')}</h3>
          {allergens.length === 0 ? (
            <p>{t('predefinedPizzas.noAllergens')}</p>
          ) : (
            <ul>
              {allergens.map((allergen) => (
                <li key={allergen}>
                  <strong>{allergen}</strong>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

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
              onClick={handleDeactivate}
              disabled={submitting}
            >
              {t('predefinedPizzas.deactivate')}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
