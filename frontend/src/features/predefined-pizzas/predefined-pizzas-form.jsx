import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  usePostPredefinedPizzas,
  usePutPredefinedPizzasId,
} from '../../api/generated/default/default';
import { invalidateResource } from '../../shared/api/invalidate.js';
import { useSubmit } from '../../shared/forms/use-submit.js';
import { useFieldErrors } from '../../shared/forms/use-field-errors.js';
import { fieldProps, makeIdFor } from '../../shared/forms/field-props.js';
import { hasErrors } from '../../shared/forms/validators.js';
import FieldError from '../../shared/ui/feedback/field-error.jsx';
import FormErrors from '../../shared/ui/feedback/form-errors.jsx';
import Spinner from '../../shared/ui/feedback/spinner.jsx';
import {
  diagnosePizzaRefusal,
  getPredefinedPizzaErrorKey,
} from './predefined-pizzas-errors.js';
import { usePizzaReferences } from './use-pizza-reference.js';

const idFor = makeIdFor('predefined-pizza');

/** Client checks: what is required to send the request; every business rule stays in the API. */
function validate(values, isEdit) {
  const errors = {};
  if (!isEdit && !values.productId) errors.productId = { type: 'any.required' };
  if (values.componentIds.length === 0) {
    errors.componentIds = { type: 'array.min', limit: 1 };
  }
  if (values.sizeIds.length === 0) {
    errors.sizeIds = { type: 'array.min', limit: 1 };
  }
  return errors;
}

export default function PredefinedPizzaForm({ pizza, onSaved, onCancel }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const formRef = useRef(null);
  const isEdit = Boolean(pizza?.id);
  const refs = usePizzaReferences();

  const [values, setValues] = useState({
    productId: '',
    componentIds: (pizza?.defaultConfiguration?.components ?? []).map(
      (c) => c.id
    ),
    sizeIds: pizza?.sizeIds ?? [],
  });
  const [problems, setProblems] = useState([]);
  const { submit, submitting, error } = useSubmit();
  const { errors, setErrors, fromApi, clearField } = useFieldErrors(formRef);
  const createPizza = usePostPredefinedPizzas();
  const updatePizza = usePutPredefinedPizzasId();

  const toggle = (field, id, checked) => {
    setValues((previous) => ({
      ...previous,
      [field]: checked
        ? [...previous[field], id]
        : previous[field].filter((value) => value !== id),
    }));
    clearField(field);
    setProblems([]);
  };

  // Products that can still get a pizza: active, sellable, not a component, without a pizza.
  const withPizza = new Set(refs.pizzas.map((p) => p.productId));
  const productOptions = refs.products.filter(
    (p) =>
      p.isActive !== false &&
      p.sellable &&
      !p.pizzaComponentTypeId &&
      !withPizza.has(p.id)
  );
  // Active choices, plus inactive ones still selected (so they can be seen and unchecked).
  const componentOptions = refs.products.filter(
    (p) =>
      p.pizzaComponentTypeId &&
      (p.isActive !== false || values.componentIds.includes(p.id))
  );
  const sizeOptions = refs.sizes.filter(
    (s) => s.isActive !== false || values.sizeIds.includes(s.id)
  );
  // Selected components whose type was removed: shown apart so they can be unchecked.
  const activeTypeIds = new Set(refs.types.map((type) => type.id));
  const withoutType = componentOptions.filter(
    (p) =>
      !activeTypeIds.has(p.pizzaComponentTypeId) &&
      values.componentIds.includes(p.id)
  );
  const inactiveBadge = (item) =>
    item.isActive === false && (
      <span className="entity-badge is-inactive">{t('entity.inactive')}</span>
    );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setProblems([]);

    const clientErrors = validate(values, isEdit);
    setErrors(clientErrors);
    if (hasErrors(clientErrors)) return;

    const data = {
      sizeIds: values.sizeIds,
      componentIds: values.componentIds,
    };
    if (!isEdit) data.productId = values.productId;
    const name = isEdit
      ? pizza.product?.name
      : refs.productById.get(values.productId)?.name;

    const result = await submit(
      () =>
        isEdit
          ? updatePizza.mutateAsync({ id: pizza.id, data })
          : createPizza.mutateAsync({ data }),
      {
        successKey: isEdit
          ? 'predefinedPizzas.updated'
          : 'predefinedPizzas.created',
        successParams: { name },
      }
    );

    if (
      result.ok ||
      result.error?.outcomeUnknown ||
      result.error?.status === 404
    ) {
      // Predefined pizzas are also shown by the catalogue.
      await invalidateResource(queryClient, '/predefined-pizzas', '/catalogue');
    }
    if (result.ok) {
      onSaved(result.value);
    } else if (
      result.error?.status === 400 &&
      result.error.fieldErrors.length === 0
    ) {
      setProblems(await diagnosePizzaRefusal(queryClient, data));
    } else if (result.error) {
      fromApi(result.error); // the choices are kept
    }
  };

  const errorKey = getPredefinedPizzaErrorKey('save', error);
  const labels = {
    productId: t('predefinedPizzas.form.product'),
    componentIds: t('predefinedPizzas.form.components'),
    sizeIds: t('predefinedPizzas.form.sizes'),
  };
  const showApiError = !errorKey && problems.length === 0;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="entity-card entity-form"
      noValidate
      aria-busy={submitting}
    >
      <h2>
        {isEdit
          ? t('predefinedPizzas.form.editTitle', { name: pizza.product?.name })
          : t('predefinedPizzas.form.createTitle')}
      </h2>
      <p className="entity-hint">{t('entity.required')}</p>

      <FormErrors
        errors={errors}
        error={showApiError ? error : null}
        labels={labels}
        idFor={idFor}
      />
      {errorKey && (
        <p className="message message-error" role="alert">
          {t(errorKey)}
        </p>
      )}
      {problems.length > 0 && (
        <div className="message message-error" role="alert">
          <strong>{t('predefinedPizzas.errors.refused')}</strong>
          <ul>
            {problems.map((problem) => (
              <li key={`${problem.key}-${JSON.stringify(problem.params)}`}>
                {t(problem.key, problem.params)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {refs.loading && <p role="status">{t('layout.loading')}</p>}

      {!isEdit && (
        <div>
          <label htmlFor={idFor('productId')}>{labels.productId} *</label>
          <select
            value={values.productId}
            required
            onChange={(event) => {
              setValues((previous) => ({
                ...previous,
                productId: event.target.value,
              }));
              clearField('productId');
            }}
            {...fieldProps('productId', errors, idFor)}
          >
            <option value="">{t('predefinedPizzas.form.chooseProduct')}</option>
            {productOptions.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
          <FieldError
            id={`${idFor('productId')}-error`}
            error={errors.productId}
          />
          <p className="entity-hint">
            {t('predefinedPizzas.form.productHint')}
          </p>
        </div>
      )}

      <fieldset className="entity-form">
        <legend id={idFor('componentIds')} tabIndex={-1}>
          {labels.componentIds} *
        </legend>
        <p className="entity-hint">
          {t('predefinedPizzas.form.componentsHint')}
        </p>
        <FieldError
          id={`${idFor('componentIds')}-error`}
          error={errors.componentIds}
        />
        {refs.types.map((type) => {
          const options = componentOptions.filter(
            (p) => p.pizzaComponentTypeId === type.id
          );
          const count = values.componentIds.filter((id) =>
            options.some((p) => p.id === id)
          ).length;
          const max = type.maxQuantity ?? null;
          const outOfRange =
            count < (type.minQuantity ?? 0) || (max !== null && count > max);
          return (
            <div key={type.id}>
              <h3>
                {type.assemblyOrder}. {type.name}
              </h3>
              <p
                className={
                  outOfRange ? 'message message-warning' : 'entity-hint'
                }
              >
                {t('predefinedPizzas.form.typeRange', {
                  count,
                  min: type.minQuantity ?? 0,
                  max: max === null ? t('pizzaComponentTypes.unlimited') : max,
                })}
              </p>
              {options.length === 0 && (
                <p className="entity-hint">
                  {t('predefinedPizzas.form.noComponents')}
                </p>
              )}
              {options.map((product) => (
                <label key={product.id}>
                  <input
                    type="checkbox"
                    checked={values.componentIds.includes(product.id)}
                    onChange={(event) =>
                      toggle('componentIds', product.id, event.target.checked)
                    }
                  />{' '}
                  {product.name} {inactiveBadge(product)}
                </label>
              ))}
            </div>
          );
        })}
        {withoutType.length > 0 && (
          <div>
            <h3>{t('predefinedPizzas.form.otherComponents')}</h3>
            {withoutType.map((product) => (
              <label key={product.id}>
                <input
                  type="checkbox"
                  checked
                  onChange={(event) =>
                    toggle('componentIds', product.id, event.target.checked)
                  }
                />{' '}
                {product.name} {inactiveBadge(product)}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <fieldset className="entity-form">
        <legend id={idFor('sizeIds')} tabIndex={-1}>
          {labels.sizeIds} *
        </legend>
        <p className="entity-hint">{t('predefinedPizzas.form.sizesHint')}</p>
        <FieldError id={`${idFor('sizeIds')}-error`} error={errors.sizeIds} />
        {sizeOptions.map((size) => (
          <label key={size.id}>
            <input
              type="checkbox"
              checked={values.sizeIds.includes(size.id)}
              onChange={(event) =>
                toggle('sizeIds', size.id, event.target.checked)
              }
            />{' '}
            {size.name} {inactiveBadge(size)}
          </label>
        ))}
      </fieldset>

      <div className="entity-actions entity-form-actions">
        <button
          type="button"
          className="secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          {t('entity.cancel')}
        </button>
        <button type="submit" disabled={submitting}>
          {submitting && <Spinner />}
          {submitting ? t('entity.saving') : t('entity.save')}
        </button>
      </div>
    </form>
  );
}
