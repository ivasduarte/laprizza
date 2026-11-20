import { useTranslation } from 'react-i18next';
import { fieldProps } from '../../shared/forms/field-props.js';
import FieldError from '../../shared/ui/feedback/field-error.jsx';
import { itemField, newItem } from './use-product-references.js';

export default function ProductAggregateFields({
  kind,
  items,
  candidates,
  onKindChange,
  onItemsChange,
  errors,
  idFor,
  clearField,
}) {
  const { t } = useTranslation();

  const updateItem = (index, patch) => {
    onItemsChange(
      items.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
    Object.keys(patch).forEach((name) => clearField(itemField(index, name)));
    clearField('aggregate.items');
  };

  const kinds = [
    ['none', 'products.form.aggregateNone'],
    ['PRODUCED', 'products.form.aggregateProduced'],
    ['PURCHASED', 'products.form.aggregatePurchased'],
  ];

  return (
    <fieldset className="entity-form">
      <legend>{t('products.form.aggregate')}</legend>
      {kinds.map(([value, labelKey]) => (
        <label key={value}>
          <input
            type="radio"
            name="product-aggregate-kind"
            value={value}
            checked={kind === value}
            onChange={() => onKindChange(value)}
          />{' '}
          {t(labelKey)}
        </label>
      ))}

      {kind === 'PRODUCED' && (
        <div className="entity-form">
          <h3>{t('products.form.items')}</h3>
          <p className="entity-hint">{t('products.form.itemsHint')}</p>
          {candidates.length === 0 && (
            <p className="message message-warning">
              {t('products.form.noCandidates')}
            </p>
          )}
          <FieldError
            id={`${idFor('aggregate.items')}-error`}
            error={errors['aggregate.items']}
          />

          {items.map((item, index) => {
            const usedElsewhere = new Set(
              items.filter((_, i) => i !== index).map((i) => i.productId)
            );
            const options = candidates.filter(
              (product) => !usedElsewhere.has(product.id)
            );
            const productField = itemField(index, 'productId');
            const quantityField = itemField(index, 'quantity');
            const position = index + 1;
            return (
              <div key={item.key} className="entity-actions">
                <div>
                  <label htmlFor={idFor(productField)}>
                    {t('products.form.itemProduct', { index: position })}
                  </label>
                  <select
                    value={item.productId}
                    onChange={(event) =>
                      updateItem(index, { productId: event.target.value })
                    }
                    {...fieldProps(productField, errors, idFor)}
                  >
                    <option value="">{t('products.form.chooseProduct')}</option>
                    {options.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                  <FieldError
                    id={`${idFor(productField)}-error`}
                    error={errors[productField]}
                  />
                </div>
                <div>
                  <label htmlFor={idFor(quantityField)}>
                    {t('products.form.itemQuantity', { index: position })}
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min={1}
                    value={item.quantity}
                    onChange={(event) =>
                      updateItem(index, { quantity: event.target.value })
                    }
                    {...fieldProps(quantityField, errors, idFor)}
                  />
                  <FieldError
                    id={`${idFor(quantityField)}-error`}
                    error={errors[quantityField]}
                  />
                </div>
                <button
                  type="button"
                  className="secondary small"
                  onClick={() =>
                    onItemsChange(items.filter((_, i) => i !== index))
                  }
                >
                  {t('products.form.removeItem', { index: position })}
                </button>
              </div>
            );
          })}

          <div>
            <button
              type="button"
              className="secondary small"
              onClick={() => onItemsChange([...items, newItem()])}
              disabled={items.length >= candidates.length}
            >
              {t('products.form.addItem')}
            </button>
          </div>
        </div>
      )}
    </fieldset>
  );
}
