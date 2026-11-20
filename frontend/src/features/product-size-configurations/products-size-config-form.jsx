import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  usePostProductsProductIdSizeConfigurations,
  usePutProductsProductIdSizeConfigurationsSizeId,
} from '../../api/generated/default/default';
import { invalidateResource } from '../../shared/api/invalidate.js';
import { useSubmit } from '../../shared/forms/use-submit.js';
import { useFieldErrors } from '../../shared/forms/use-field-errors.js';
import { fieldProps, makeIdFor } from '../../shared/forms/field-props.js';
import {
  hasErrors,
  integer,
  minValue,
  required,
  validateForm,
} from '../../shared/forms/validators.js';
import FieldError from '../../shared/ui/feedback/field-error.jsx';
import FormErrors from '../../shared/ui/feedback/form-errors.jsx';
import Spinner from '../../shared/ui/feedback/spinner.jsx';
import { getSizeConfigErrorKey } from '../products/products-errors.js';

/** The price must be a number (decimals allowed). */
const isNumber = () => (value) =>
  value !== '' && Number.isNaN(Number(value)) ? { type: 'number.base' } : null;

const PRICE_RULES = [required(), isNumber(), minValue(0)];
const UNITS_RULES = [required(), integer(), minValue(1)];

const toText = (value) =>
  value === null || value === undefined ? '' : String(value);

export default function ProductSizeConfigForm({
  product,
  size,
  config,
  onDone,
  onCancel,
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const formRef = useRef(null);
  const isEdit = Boolean(config);
  const withUnits = Boolean(product.stockControlled);
  const idFor = makeIdFor(`size-config-${size.id}`);

  const [values, setValues] = useState({
    price: toText(config?.price),
    stockUnitsConsumed: toText(config?.stockUnitsConsumed),
  });
  const { submit, submitting, error } = useSubmit();
  const { errors, setErrors, fromApi, clearField } = useFieldErrors(formRef);
  const createConfig = usePostProductsProductIdSizeConfigurations();
  const updateConfig = usePutProductsProductIdSizeConfigurationsSizeId();

  const change = (field, value) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    clearField(field);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const schema = withUnits
      ? { price: PRICE_RULES, stockUnitsConsumed: UNITS_RULES }
      : { price: PRICE_RULES };
    const clientErrors = validateForm(values, schema);
    setErrors(clientErrors);
    if (hasErrors(clientErrors)) return;

    // Numbers only (Joi strict); no units for products without stock control.
    const data = {
      price: Number(values.price),
      stockUnitsConsumed: withUnits ? Number(values.stockUnitsConsumed) : null,
    };
    const result = await submit(
      () =>
        isEdit
          ? updateConfig.mutateAsync({
              productId: product.id,
              sizeId: size.id,
              data,
            })
          : createConfig.mutateAsync({
              productId: product.id,
              data: { pizzaSizeId: size.id, ...data },
            }),
      {
        successKey: isEdit
          ? 'products.sizeConfigs.updated'
          : 'products.sizeConfigs.created',
        successParams: { size: size.name },
      }
    );

    if (
      result.ok ||
      result.error?.outcomeUnknown ||
      result.error?.status === 404 ||
      result.error?.status === 409
    ) {
      await invalidateResource(
        queryClient,
        '/products',
        '/catalogue',
        '/predefined-pizzas'
      );
    }
    if (result.ok) {
      onDone();
    } else if (result.error) {
      fromApi(result.error); 
    }
  };

  const errorKey = getSizeConfigErrorKey('save', error);
  const labels = {
    price: t('products.sizeConfigs.price'),
    stockUnitsConsumed: t('products.sizeConfigs.stockUnits'),
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="entity-form"
      noValidate
      aria-busy={submitting}
      aria-label={t(
        isEdit
          ? 'products.sizeConfigs.editTitle'
          : 'products.sizeConfigs.createTitle',
        { size: size.name }
      )}
    >
      <FormErrors
        errors={errors}
        error={errorKey ? null : error}
        labels={labels}
        idFor={idFor}
      />
      {errorKey && (
        <p className="message message-error" role="alert">
          {t(errorKey)}
        </p>
      )}

      <div className="entity-actions">
        <div>
          <label htmlFor={idFor('price')}>{labels.price} *</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            value={values.price}
            required
            onChange={(event) => change('price', event.target.value)}
            {...fieldProps('price', errors, idFor)}
          />
          <FieldError id={`${idFor('price')}-error`} error={errors.price} />
        </div>
        {withUnits && (
          <div>
            <label htmlFor={idFor('stockUnitsConsumed')}>
              {labels.stockUnitsConsumed} *
            </label>
            <input
              type="number"
              inputMode="numeric"
              step="1"
              min={1}
              value={values.stockUnitsConsumed}
              required
              onChange={(event) =>
                change('stockUnitsConsumed', event.target.value)
              }
              {...fieldProps('stockUnitsConsumed', errors, idFor)}
            />
            <FieldError
              id={`${idFor('stockUnitsConsumed')}-error`}
              error={errors.stockUnitsConsumed}
            />
          </div>
        )}
      </div>

      <div className="entity-actions">
        <button
          type="button"
          className="secondary small"
          onClick={onCancel}
          disabled={submitting}
        >
          {t('entity.cancel')}
        </button>
        <button type="submit" className="small" disabled={submitting}>
          {submitting && <Spinner />}
          {submitting ? t('entity.saving') : t('entity.save')}
        </button>
      </div>
    </form>
  );
}
