import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetAllergens,
  usePatchCustomersId,
} from '../../api/generated/default/default';
import { invalidateResource } from '../../shared/api/invalidate.js';
import { useCan } from '../../shared/auth/use-can.js';
import { useConfirm } from '../../shared/feedback/use-feedback.js';
import { useSubmit } from '../../shared/forms/use-submit.js';
import { getCustomerErrorKey } from './customers-errors.js';

/** Contacts and address of a customer; shared by the MANAGER detail and "My data". */
export function CustomerContacts({ customer }) {
  const { t } = useTranslation();
  const address = customer.address ?? {};
  return (
    <dl className="entity-fields">
      <dt>{t('customers.fields.name')}</dt>
      <dd>{customer.name}</dd>
      <dt>{t('customers.fields.email')}</dt>
      <dd>{customer.email}</dd>
      <dt>{t('customers.fields.phoneNumber')}</dt>
      <dd>{customer.phoneNumber}</dd>
      <dt>{t('customers.fields.address')}</dt>
      <dd>
        {address.street} {address.houseNumber}
        {address.complement && `, ${address.complement}`}
        <br />
        {address.postalCode} {address.city}
        <br />
        {address.district}
      </dd>
    </dl>
  );
}

export default function CustomerDetail({ customer, onEdit, onClose }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canWrite = useCan('customers:write');
  const canReadAllergens = useCan('allergens:read');
  const allergens = useGetAllergens(undefined, {
    query: { enabled: canReadAllergens },
  });
  const confirm = useConfirm();
  const { submit, submitting, error } = useSubmit();
  const updateCustomer = usePatchCustomersId();
  const active = customer.isActive !== false;

  const allergenById = new Map(
    (allergens.data ?? []).map((allergen) => [allergen.id, allergen])
  );
  const restrictions = (customer.dietaryRestrictions ?? []).map(
    (id) => allergenById.get(id)?.name ?? t('customers.unknownAllergen')
  );

  const handleToggleActive = async () => {
    if (active) {
      const confirmed = await confirm({
        titleKey: 'customers.confirmDeactivateTitle',
        messageKey: 'customers.confirmDeactivate',
        params: { name: customer.name },
        confirmKey: 'customers.deactivate',
        tone: 'danger',
      });
      if (!confirmed) return;
    }

    const result = await submit(
      () =>
        updateCustomer.mutateAsync({
          id: customer.id,
          data: { isActive: !active },
        }),
      {
        successKey: active ? 'customers.deactivated' : 'customers.activated',
        successParams: { name: customer.name },
      }
    );
    if (
      result.ok ||
      result.error?.outcomeUnknown ||
      result.error?.status === 404
    ) {
      await invalidateResource(queryClient, '/customers');
    }
  };

  const errorKey = getCustomerErrorKey(
    active ? 'deactivate' : 'activate',
    error
  );

  return (
    <section className="entity-card" aria-labelledby="customer-title">
      <h2 id="customer-title">
        {t('customers.detailTitle', { name: customer.name })}
      </h2>

      {error && !error.global && (
        <p className="message message-error" role="alert">
          {errorKey ? t(errorKey) : t(`feedback.errors.${error.kind}`)}
        </p>
      )}
      {!active && (
        <p className="message message-warning">{t('customers.inactiveNote')}</p>
      )}

      <CustomerContacts customer={customer} />
      <dl className="entity-fields">
        <dt>{t('entity.status')}</dt>
        <dd>
          <span className={`entity-badge${active ? '' : ' is-inactive'}`}>
            {t(active ? 'entity.active' : 'entity.inactive')}
          </span>
        </dd>
      </dl>

      {/* Dietary restrictions only for users who can read allergens (MANAGER). */}
      {canReadAllergens && (
        <>
          <h3>{t('customers.fields.dietaryRestrictions')}</h3>
          {restrictions.length === 0 ? (
            <p>{t('customers.noRestrictions')}</p>
          ) : (
            <ul>
              {restrictions.map((name, index) => (
                <li key={`${name}-${index}`}>
                  <strong>{name}</strong>
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
              className={active ? 'danger' : undefined}
              onClick={handleToggleActive}
              disabled={submitting}
            >
              {t(active ? 'customers.deactivate' : 'customers.activate')}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
