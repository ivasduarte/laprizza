import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  usePatchProductsId,
  usePostProducts,
} from '../../api/generated/default/default';
import { invalidateResource } from '../../shared/api/invalidate.js';
import { useSubmit } from '../../shared/forms/use-submit.js';
import { useFieldErrors } from '../../shared/forms/use-field-errors.js';
import { fieldProps, makeIdFor } from '../../shared/forms/field-props.js';
import {
  hasErrors,
  integer,
  maxLength,
  minValue,
  required,
  validateField,
  validateForm,
} from '../../shared/forms/validators.js';
import FieldError from '../../shared/ui/feedback/field-error.jsx';
import FormErrors from '../../shared/ui/feedback/form-errors.jsx';
import Spinner from '../../shared/ui/feedback/spinner.jsx';
import ProductAggregateFields from './products-aggregate-fields.jsx';
import { getProductErrorKey } from './products-errors.js';
import {
  itemField,
  newItem,
  useProductReferences,
} from './use-product-references.js';

/** The price must be a number (decimals allowed). */
const isNumber = () => (value) =>
  value !== '' && Number.isNaN(Number(value)) ? { type: 'number.base' } : null;

// Same limits as the API; references, uniqueness and aggregate rules stay in the back end.
const SCHEMA = {
  name: [required(), maxLength(100)],
  description: [required()],
  categoryId: [required()],
};
const PRICE_RULES = [required(), isNumber(), minValue(0)];
const TYPE_RULES = [required()];
const ITEM_PRODUCT_RULES = [required()];
const ITEM_QUANTITY_RULES = [required(), integer(), minValue(1)];
const idFor = makeIdFor('product');

function initialValues(product) {
  const aggregate = product?.aggregate ?? null;
  return {
    name: product?.name ?? '',
    description: product?.description ?? '',
    categoryId: product?.categoryId ?? '',
    sellable: product?.sellable ?? false,
    price:
      product?.price === null || product?.price === undefined
        ? ''
        : String(product.price),
    stockControlled: product?.stockControlled ?? false,
    isComponent: Boolean(product?.pizzaComponentTypeId),
    pizzaComponentTypeId: product?.pizzaComponentTypeId ?? '',
    allergenIds: product?.allergenIds ?? [],
    aggregateKind: aggregate?.classification ?? 'none',
    items:
      aggregate?.classification === 'PRODUCED'
        ? aggregate.items.map((item) =>
            newItem(item.productId, String(item.quantity))
          )
        : [],
  };
}

function validate(values) {
  const errors = validateForm(values, SCHEMA);
  const check = (field, value, rules) => {
    const violation = validateField(value, rules, values);
    if (violation) errors[field] = violation;
  };
  if (values.sellable) check('price', values.price, PRICE_RULES);
  if (values.isComponent) {
    check('pizzaComponentTypeId', values.pizzaComponentTypeId, TYPE_RULES);
  }
  if (values.aggregateKind === 'PRODUCED') {
    if (values.items.length === 0) {
      errors['aggregate.items'] = { type: 'array.min', limit: 1 };
    }
    values.items.forEach((item, index) => {
      check(itemField(index, 'productId'), item.productId, ITEM_PRODUCT_RULES);
      check(itemField(index, 'quantity'), item.quantity, ITEM_QUANTITY_RULES);
    });
  }
  return errors;
}

function toPayload(values, isEdit) {
  const data = {
    name: values.name.trim(),
    description: values.description.trim(),
    categoryId: values.categoryId,
    sellable: values.sellable,
    allergenIds: values.allergenIds,
    pizzaComponentTypeId: values.isComponent
      ? values.pizzaComponentTypeId
      : null,
  };
  if (values.sellable) data.price = Number(values.price);
  if (!isEdit) data.stockControlled = values.stockControlled;

  if (values.aggregateKind === 'none') {
    if (isEdit) data.aggregate = null; 
  } else {
    data.aggregate = {
      classification: values.aggregateKind,
      items:
        values.aggregateKind === 'PRODUCED'
          ? values.items.map((item) => ({
              productId: item.productId,
              quantity: Number(item.quantity),
            }))
          : [],
    };
  }
  return data;
}

export default function ProductForm({ product, onSaved, onCancel }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const formRef = useRef(null);
  const isEdit = Boolean(product?.id);

  const refs = useProductReferences({ withProducts: true });
  const [values, setValues] = useState(() => initialValues(product));
  const { submit, submitting, error } = useSubmit();
  const { errors, setErrors, fromApi, clearField } = useFieldErrors(formRef);
  const createProduct = usePostProducts();
  const updateProduct = usePatchProductsId();

  const change = (field, value) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    clearField(field);
  };

  const toggleAllergen = (allergenId, checked) =>
    change(
      'allergenIds',
      checked
        ? [...values.allergenIds, allergenId]
        : values.allergenIds.filter((id) => id !== allergenId)
    );

  // Items: active products that are not aggregates and are not this product.
  const candidates = refs.products.filter(
    (candidate) =>
      candidate.isActive !== false &&
      !candidate.aggregate &&
      candidate.id !== product?.id
  );

  const handleSubmit = async (event) => {
    event.preventDefault();

    const clientErrors = validate(values);
    setErrors(clientErrors);
    if (hasErrors(clientErrors)) return;

    const data = toPayload(values, isEdit);
    const result = await submit(
      () =>
        isEdit
          ? updateProduct.mutateAsync({ id: product.id, data })
          : createProduct.mutateAsync({ data }),
      {
        successKey: isEdit ? 'products.updated' : 'products.created',
        successParams: { name: data.name },
      }
    );

    if (
      result.ok ||
      result.error?.outcomeUnknown ||
      result.error?.status === 404
    ) {
      // Products are also shown by the catalogue, the stock and the predefined pizzas.
      await invalidateResource(
        queryClient,
        '/products',
        '/catalogue',
        '/stock',
        '/predefined-pizzas'
      );
    }
    if (result.ok) {
      onSaved(result.value);
    } else if (result.error?.status === 409) {
      setErrors({ name: { type: 'product.nameTaken' } });
    } else if (result.error) {
      fromApi(result.error); // the inputs keep their values
    }
  };

  const errorKey = getProductErrorKey('save', error);
  const labels = {
    name: t('products.form.name'),
    description: t('products.form.description'),
    categoryId: t('products.form.category'),
    price: t('products.form.price'),
    pizzaComponentTypeId: t('products.form.componentType'),
    allergenIds: t('products.form.allergens'),
    'aggregate.items': t('products.form.items'),
    ...Object.fromEntries(
      values.items.flatMap((_, index) => [
        [
          itemField(index, 'productId'),
          t('products.form.itemProduct', { index: index + 1 }),
        ],
        [
          itemField(index, 'quantity'),
          t('products.form.itemQuantity', { index: index + 1 }),
        ],
      ])
    ),
  };

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
          ? t('products.form.editTitle', { name: product.name })
          : t('products.form.createTitle')}
      </h2>
      <p className="entity-hint">{t('entity.required')}</p>

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

      <div>
        <label htmlFor={idFor('name')}>{labels.name} *</label>
        <input
          type="text"
          value={values.name}
          maxLength={100}
          required
          onChange={(event) => change('name', event.target.value)}
          {...fieldProps('name', errors, idFor)}
        />
        <FieldError id={`${idFor('name')}-error`} error={errors.name} />
      </div>

      <div>
        <label htmlFor={idFor('description')}>{labels.description} *</label>
        <textarea
          value={values.description}
          rows={3}
          required
          onChange={(event) => change('description', event.target.value)}
          {...fieldProps('description', errors, idFor)}
        />
        <FieldError
          id={`${idFor('description')}-error`}
          error={errors.description}
        />
      </div>

      <div>
        <label htmlFor={idFor('categoryId')}>{labels.categoryId} *</label>
        <select
          value={values.categoryId}
          required
          onChange={(event) => change('categoryId', event.target.value)}
          {...fieldProps('categoryId', errors, idFor)}
        >
          <option value="">{t('products.form.chooseCategory')}</option>
          {refs.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <FieldError
          id={`${idFor('categoryId')}-error`}
          error={errors.categoryId}
        />
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={values.sellable}
            onChange={(event) => {
              change('sellable', event.target.checked);
              clearField('price');
            }}
          />{' '}
          {t('products.form.sellable')}
        </label>
      </div>
      {values.sellable && (
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
      )}

      <div>
        <label>
          <input
            type="checkbox"
            checked={values.stockControlled}
            disabled={isEdit}
            onChange={(event) =>
              change('stockControlled', event.target.checked)
            }
          />{' '}
          {t('products.form.stockControlled')}
        </label>
        {isEdit && (
          <p className="entity-hint">{t('products.form.stockLocked')}</p>
        )}
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={values.isComponent}
            onChange={(event) => {
              change('isComponent', event.target.checked);
              clearField('pizzaComponentTypeId');
            }}
          />{' '}
          {t('products.form.pizzaComponent')}
        </label>
      </div>
      {values.isComponent && (
        <div>
          <label htmlFor={idFor('pizzaComponentTypeId')}>
            {labels.pizzaComponentTypeId} *
          </label>
          <select
            value={values.pizzaComponentTypeId}
            required
            onChange={(event) =>
              change('pizzaComponentTypeId', event.target.value)
            }
            {...fieldProps('pizzaComponentTypeId', errors, idFor)}
          >
            <option value="">{t('products.form.chooseType')}</option>
            {refs.types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
          <FieldError
            id={`${idFor('pizzaComponentTypeId')}-error`}
            error={errors.pizzaComponentTypeId}
          />
        </div>
      )}

      <fieldset className="entity-form">
        <legend>{labels.allergenIds}</legend>
        {refs.allergens.length === 0 && (
          <p className="entity-hint">
            {t('products.form.noAllergensAvailable')}
          </p>
        )}
        {refs.allergens.map((allergen) => (
          <label key={allergen.id}>
            <input
              type="checkbox"
              checked={values.allergenIds.includes(allergen.id)}
              onChange={(event) =>
                toggleAllergen(allergen.id, event.target.checked)
              }
            />{' '}
            {allergen.name}
          </label>
        ))}
        <FieldError
          id={`${idFor('allergenIds')}-error`}
          error={errors.allergenIds}
        />
      </fieldset>

      <ProductAggregateFields
        kind={values.aggregateKind}
        items={values.items}
        candidates={candidates}
        onKindChange={(kind) => {
          change('aggregateKind', kind);
          if (kind === 'PRODUCED' && values.items.length === 0) {
            change('items', [newItem()]);
          }
        }}
        onItemsChange={(items) => change('items', items)}
        errors={errors}
        idFor={idFor}
        clearField={clearField}
      />

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
