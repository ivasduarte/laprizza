import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fieldProps, makeIdFor } from '../../../shared/forms/field-props.js';
import { useSubmit } from '../../../shared/forms/use-submit.js';
import FieldError from '../../../shared/ui/feedback/field-error.jsx';
import FormErrors from '../../../shared/ui/feedback/form-errors.jsx';
import { forecastsApi } from '../shared/ai-api.js';
import { aiViolations, toErrorMap } from '../shared/ai-errors.js';
import {
  emptyEntry,
  emptyForm,
  fromForecast,
  toPayload,
  validateForecast,
} from './forecast-model.js';

const idFor = makeIdFor('forecast');

const nextDay = (day) => {
  const date = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

/**
 * Creates a forecast or the next version of an existing one (`base`). Forecasts are immutable:
 * saving always creates a new version and the previous results stay linked to the old one.
 *
 * @param {{options: Array, base?: object|null, onCancel: Function, onSaved: (forecast) => void}} props
 */
export default function ForecastForm({
  options,
  base = null,
  onCancel,
  onSaved,
}) {
  const { t } = useTranslation();
  const formRef = useRef(null);
  const [form, setForm] = useState(() =>
    base ? fromForecast(base) : emptyForm()
  );
  const [errors, setErrors] = useState({});
  const { submit, submitting, error } = useSubmit();
  const productById = new Map(options.map((o) => [o.id, o]));

  const clear = (...fields) =>
    setErrors((prev) => {
      const next = { ...prev };
      fields.forEach((f) => delete next[f]);
      return next;
    });

  const setField = (field) => (event) => {
    setForm((f) => ({ ...f, [field]: event.target.value }));
    clear(field);
  };

  const setEntry = (index, patch) => {
    setForm((f) => ({
      ...f,
      entries: f.entries.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    }));
    clear(
      ...Object.keys(patch).map((k) => `entries.${index}.${k}`),
      `entries.${index}`
    );
  };

  const changeProduct = (index) => (event) => {
    const product = productById.get(event.target.value);
    const current = form.entries[index].sizeId;
    const sizes = product?.sizes ?? [];
    // Keep the size when it still applies; a single size is chosen automatically.
    const sizeId = sizes.some((s) => s.id === current)
      ? current
      : sizes.length === 1
        ? sizes[0].id
        : '';
    setEntry(index, { productId: event.target.value, sizeId });
  };

  const addEntry = () => {
    setForm((f) => ({ ...f, entries: [...f.entries, emptyEntry()] }));
    clear('entries');
  };
  const duplicateEntry = (index) =>
    setForm((f) => {
      const copy = {
        ...f.entries[index],
        date: nextDay(f.entries[index].date),
      };
      const entries = [...f.entries];
      entries.splice(index + 1, 0, copy);
      return { ...f, entries };
    });
  // Row indexes shift: the old errors would point at the wrong rows.
  const removeEntry = (index) => {
    setForm((f) => ({
      ...f,
      entries: f.entries.filter((_, i) => i !== index),
    }));
    setErrors({});
  };

  async function save(event) {
    event.preventDefault();
    if (submitting) return;
    const problems = validateForecast(form, options);
    setErrors(toErrorMap(problems));
    if (problems.length > 0) {
      requestAnimationFrame(() =>
        formRef.current?.querySelector('[aria-invalid="true"]')?.focus()
      );
      return;
    }
    const result = await submit(() => forecastsApi.create(toPayload(form)));
    if (result.ok) {
      onSaved(result.value);
    } else if (result.error?.kind === 'validation') {
      setErrors(toErrorMap(aiViolations(result.error).fieldErrors));
    }
  }

  const entryLabel = (i, field) =>
    `${t('ai.fc.entryN', { n: i + 1 })} · ${t(`ai.f.${field}`)}`;
  const labels = {
    name: t('ai.f.name'),
    startDate: t('ai.f.start'),
    endDate: t('ai.f.end'),
    entries: t('ai.f.entries'),
    ...Object.fromEntries(
      form.entries.flatMap((_, i) => [
        [`entries.${i}`, t('ai.fc.entryN', { n: i + 1 })],
        ...['date', 'productId', 'sizeId', 'quantity'].map((field) => [
          `entries.${i}.${field}`,
          entryLabel(
            i,
            field === 'productId'
              ? 'product'
              : field === 'sizeId'
                ? 'size'
                : field
          ),
        ]),
      ])
    ),
  };
  // WEB07 requests are silent (no global toast), so every failure is explained here.
  const apiError = error && {
    ...error,
    global: false,
    formErrors:
      error.kind === 'validation'
        ? aiViolations(error).formErrors
        : error.formErrors,
  };

  return (
    <form
      ref={formRef}
      className="ai-card"
      onSubmit={save}
      noValidate
      aria-busy={submitting}
      aria-labelledby="forecast-form-title"
    >
      <h2 id="forecast-form-title">
        {base
          ? t('ai.fc.newVersionOf', {
              name: base.name,
              version: base.version + 1,
            })
          : t('ai.f.new')}
      </h2>
      {base && (
        <p className="message message-warning">
          {t('ai.fc.immutableHint', { version: base.version })}
        </p>
      )}

      <FormErrors
        errors={errors}
        error={apiError}
        labels={labels}
        idFor={idFor}
      />

      <fieldset disabled={submitting} className="ai-fieldset">
        <div className="ai-grid">
          <div>
            <label htmlFor={idFor('name')}>{labels.name}</label>
            <input
              {...fieldProps('name', errors, idFor)}
              type="text"
              value={form.name}
              onChange={setField('name')}
              readOnly={Boolean(base)}
              maxLength={100}
              required
            />
            <FieldError id={`${idFor('name')}-error`} error={errors.name} />
          </div>
          <div>
            <label htmlFor={idFor('startDate')}>{labels.startDate}</label>
            <input
              {...fieldProps('startDate', errors, idFor)}
              type="date"
              value={form.startDate}
              onChange={setField('startDate')}
              required
            />
            <FieldError
              id={`${idFor('startDate')}-error`}
              error={errors.startDate}
            />
          </div>
          <div>
            <label htmlFor={idFor('endDate')}>{labels.endDate}</label>
            <input
              {...fieldProps('endDate', errors, idFor)}
              type="date"
              value={form.endDate}
              min={form.startDate || undefined}
              onChange={setField('endDate')}
              required
            />
            <FieldError
              id={`${idFor('endDate')}-error`}
              error={errors.endDate}
            />
          </div>
        </div>

        <p className="message">{t('ai.f.omitted')}</p>

        <h3 id="forecast-entries-title">{t('ai.f.entries')}</h3>
        <FieldError id={`${idFor('entries')}-error`} error={errors.entries} />
        <ol className="ai-entries" aria-labelledby="forecast-entries-title">
          {form.entries.map((entry, i) => {
            const at = (field) => `entries.${i}.${field}`;
            const sizes = productById.get(entry.productId)?.sizes ?? [];
            return (
              <li key={i} className="ai-entry">
                <div>
                  <label htmlFor={idFor(at('date'))}>{t('ai.f.date')}</label>
                  <input
                    {...fieldProps(at('date'), errors, idFor)}
                    type="date"
                    value={entry.date}
                    min={form.startDate || undefined}
                    max={form.endDate || undefined}
                    onChange={(e) => setEntry(i, { date: e.target.value })}
                  />
                  <FieldError
                    id={`${idFor(at('date'))}-error`}
                    error={errors[at('date')]}
                  />
                </div>
                <div>
                  <label htmlFor={idFor(at('productId'))}>
                    {t('ai.f.product')}
                  </label>
                  <select
                    {...fieldProps(at('productId'), errors, idFor)}
                    value={entry.productId}
                    onChange={changeProduct(i)}
                  >
                    <option value="">{t('ai.fc.chooseProduct')}</option>
                    {!productById.has(entry.productId) && entry.productId && (
                      <option value={entry.productId}>
                        {t('ai.fc.unknownProduct', { id: entry.productId })}
                      </option>
                    )}
                    {options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <FieldError
                    id={`${idFor(at('productId'))}-error`}
                    error={errors[at('productId')]}
                  />
                </div>
                <div>
                  <label htmlFor={idFor(at('sizeId'))}>{t('ai.f.size')}</label>
                  <select
                    {...fieldProps(at('sizeId'), errors, idFor)}
                    value={entry.sizeId}
                    onChange={(e) => setEntry(i, { sizeId: e.target.value })}
                    disabled={sizes.length === 0 && !entry.sizeId}
                  >
                    <option value="">
                      {sizes.length === 0
                        ? t('ai.fc.noSizes')
                        : t('ai.fc.chooseSize')}
                    </option>
                    {sizes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <FieldError
                    id={`${idFor(at('sizeId'))}-error`}
                    error={errors[at('sizeId')]}
                  />
                </div>
                <div>
                  <label htmlFor={idFor(at('quantity'))}>
                    {t('ai.f.quantity')}
                  </label>
                  <input
                    {...fieldProps(at('quantity'), errors, idFor)}
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    value={entry.quantity}
                    onChange={(e) => setEntry(i, { quantity: e.target.value })}
                  />
                  <FieldError
                    id={`${idFor(at('quantity'))}-error`}
                    error={errors[at('quantity')]}
                  />
                </div>
                <div className="ai-entry-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => duplicateEntry(i)}
                    aria-label={t('ai.fc.duplicateEntry', { n: i + 1 })}
                  >
                    {t('ai.fc.duplicate')}
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => removeEntry(i)}
                    aria-label={t('ai.fc.removeEntry', { n: i + 1 })}
                  >
                    {t('ai.remove')}
                  </button>
                </div>
                <FieldError
                  id={`${idFor(`entries.${i}`)}-error`}
                  error={errors[`entries.${i}`]}
                />
              </li>
            );
          })}
        </ol>
        <button type="button" className="secondary" onClick={addEntry}>
          {t('ai.f.addEntry')}
        </button>
      </fieldset>

      <div className="ai-row ai-form-actions">
        <button
          type="button"
          className="secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          {t('ai.cancel')}
        </button>
        <button type="submit" disabled={submitting}>
          {submitting ? t('ai.ui.saving') : t('ai.save')}
        </button>
      </div>
    </form>
  );
}
