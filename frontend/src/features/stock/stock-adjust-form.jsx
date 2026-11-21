import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { usePatchStockProductId } from '../../api/generated/default/default';
import { invalidateResource } from '../../shared/api/invalidate.js';
import { useConfirm } from '../../shared/feedback/use-feedback.js';
import { useSubmit } from '../../shared/forms/use-submit.js';
import { useFieldErrors } from '../../shared/forms/use-field-errors.js';
import { fieldProps, makeIdFor } from '../../shared/forms/field-props.js';
import { hasErrors, validateForm } from '../../shared/forms/validators.js';
import FieldError from '../../shared/ui/feedback/field-error.jsx';
import FormErrors from '../../shared/ui/feedback/form-errors.jsx';
import Spinner from '../../shared/ui/feedback/spinner.jsx';
import { getStockErrorKey } from './stock-errors.js';
import {
  isUnusualChange,
  MAX_STOCK_QUANTITY,
  resultingQuantity,
  StockOperation,
  stockSchema,
} from './stock-rules.js';

/** Texts per operation (WEB04: `set` records a physical count, without mental arithmetic). */
const TEXTS = {
  [StockOperation.INCREASE]: {
    title: 'stock.form.increaseTitle',
    label: 'stock.form.increaseAmount',
    action: 'stock.increase',
    success: 'stock.increased',
  },
  [StockOperation.DECREASE]: {
    title: 'stock.form.decreaseTitle',
    label: 'stock.form.decreaseAmount',
    action: 'stock.decrease',
    success: 'stock.decreased',
  },
  [StockOperation.SET]: {
    title: 'stock.form.setTitle',
    label: 'stock.form.setAmount',
    action: 'stock.set',
    success: 'stock.counted',
  },
};

export default function StockAdjustForm({
  stock,
  operation,
  onDone,
  onCancel,
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const formRef = useRef(null);
  const confirm = useConfirm();
  const idFor = makeIdFor(`stock-${stock.productId}`);
  const name = stock.product?.name ?? '';
  const isDecrease = operation === StockOperation.DECREASE;
  const isSet = operation === StockOperation.SET;
  const texts = TEXTS[operation];

  const [amount, setAmount] = useState('');
  const { submit, submitting, error } = useSubmit();
  const { errors, setErrors, fromApi, clearField } = useFieldErrors(formRef);
  const adjustStock = usePatchStockProductId();

  const handleSubmit = async (event) => {
    event.preventDefault();

    const clientErrors = validateForm({ amount }, stockSchema(operation));
    setErrors(clientErrors);
    if (hasErrors(clientErrors)) return;

    const value = Number(amount);
    const next = resultingQuantity(stock.quantity, value, operation);
    if (isUnusualChange(stock.quantity, value, operation)) {
      // WEB04: values far from the usual movements are shown back before they are sent.
      const confirmed = await confirm({
        titleKey: 'stock.confirmUnusualTitle',
        messageKey: 'stock.confirmUnusual',
        params: { name, from: stock.quantity, to: next },
        confirmKey: texts.action,
        tone: 'danger',
      });
      if (!confirmed) return;
    } else if (isDecrease) {
      const confirmed = await confirm({
        titleKey: 'stock.confirmDecreaseTitle',
        messageKey: 'stock.confirmDecrease',
        params: { amount: value, name, quantity: stock.quantity },
        confirmKey: 'stock.decrease',
        tone: 'danger',
      });
      if (!confirmed) return;
    }

    const result = await submit(
      () =>
        adjustStock.mutateAsync({
          productId: stock.productId,
          data: { amount: value, operation },
        }),
      {
        successKey: texts.success,
        successParams: { amount: value, name },
      }
    );

    // Any answer from the back end may mean the quantity on screen is out of date.
    if (result.ok || result.error) {
      await invalidateResource(queryClient, '/stock');
    }
    if (result.ok) {
      onDone();
    } else if (result.error) {
      fromApi(result.error); // the input keeps its value
    }
  };

  const errorKey = getStockErrorKey(operation, error);
  const labels = { amount: t('stock.form.amount') };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="entity-form"
      noValidate
      aria-busy={submitting}
      aria-label={t(texts.title, { name })}
    >
      <FormErrors
        errors={errors}
        error={errorKey ? null : error}
        labels={labels}
        idFor={idFor}
      />
      {errorKey && (
        <p className="message message-error" role="alert">
          {/* The quantity comes from the refreshed row. */}
          {t(errorKey, { quantity: stock.quantity, max: MAX_STOCK_QUANTITY })}
        </p>
      )}

      <div className="entity-actions">
        <div>
          <label htmlFor={idFor('amount')}>{t(texts.label)} *</label>
          <input
            type="number"
            inputMode="numeric"
            step="1"
            min={isSet ? 0 : 1}
            max={MAX_STOCK_QUANTITY}
            value={amount}
            required
            onChange={(event) => {
              setAmount(event.target.value);
              clearField('amount');
            }}
            {...fieldProps('amount', errors, idFor)}
          />
          <FieldError id={`${idFor('amount')}-error`} error={errors.amount} />
        </div>
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
        <button
          type="submit"
          className={isDecrease ? 'danger small' : 'small'}
          disabled={submitting}
        >
          {submitting && <Spinner />}
          {t(texts.action)}
        </button>
      </div>
    </form>
  );
}
