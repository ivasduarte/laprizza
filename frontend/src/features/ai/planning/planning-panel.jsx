import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../../shared/auth/use-session.js';
import { isAbortError } from '../../../shared/api/error-normalizer.js';
import { fieldProps, makeIdFor } from '../../../shared/forms/field-props.js';
import FieldError from '../../../shared/ui/feedback/field-error.jsx';
import {
  aiKeys,
  forecastsApi,
  supplierScenariosApi,
} from '../shared/ai-api.js';
import { groupForecasts, toDay } from '../forecasts/forecast-model.js';
import { calculatePlanning, PlanningKind } from './planning-api.js';
import {
  classifyPlanningError,
  STOCK_MODES,
  toPlanningRequest,
  validatePlanningInput,
} from './planning-errors.js';
import { BomResult, CodeList, RequirementsResult } from './planning-result.jsx';
import { useCan } from '../../../shared/auth/use-can.js';

const idFor = makeIdFor('planning');

/**
 * AI05 + WEB07: runs the BOM / requirements calculation through the back end and shows one of
 * four outcomes: result, invalid input (inline, per field), missing information (problems of
 * the data) or service unavailable (with retry). Nothing is changed: the result is a simulation.
 * For the requirements planning the manager chooses the forecast version and the supplier
 * scenario; every successful calculation is saved as a run (history).
 *
 * @param {{preset?: {forecastId?: string}, onOpenRun?: (runId: string) => void}} props
 */
export default function PlanningPanel({ preset = null, onOpenRun }) {
  const { t } = useTranslation();
  const { status } = useSession();

  const canExecute = useCan('planning:execute');
  const queryClient = useQueryClient();

  const [values, setValues] = useState(() => ({
    kind: preset ? PlanningKind.REQUIREMENTS : PlanningKind.BOM,
    scenarioId: '',
    stockMode: preset ? 'live' : 'scenario',
    forecastId: preset?.forecastId ?? '',
    supplierScenarioId: '',
  }));
  const [fieldErrors, setFieldErrors] = useState({});
  const [running, setRunning] = useState(false);
  const [failure, setFailure] = useState(null);
  const [outcome, setOutcome] = useState(null); // { kind, result }
  const controller = useRef(null);
  // Synchronous lock: two clicks in the same tick can not both start a calculation.
  const busy = useRef(false);

  const allowed = status === 'authenticated' && canExecute;
  const isRequirements = values.kind === PlanningKind.REQUIREMENTS;
  const forecasts = useQuery({
    queryKey: aiKeys.forecasts,
    queryFn: ({ signal }) => forecastsApi.list(signal),
    enabled: allowed && isRequirements,
  });
  const suppliers = useQuery({
    queryKey: aiKeys.suppliers,
    queryFn: ({ signal }) => supplierScenariosApi.list(signal),
    enabled: allowed && isRequirements,
  });
  const forecastGroups = useMemo(
    () => groupForecasts(forecasts.data ?? []),
    [forecasts.data]
  );

  useEffect(() => () => controller.current?.abort(), []);

  if (status !== 'authenticated') {
    return (
      <div className="ai-card">
        <p className="message">
          {t('ai.p.loginRequired')} <Link to="/login">{t('nav.login')}</Link>
        </p>
      </div>
    );
  }
  if (!allowed) {
    return (
      <div className="ai-card">
        <p className="message message-error" role="alert">
          {t('ai.p.forbidden')}
        </p>
      </div>
    );
  }

  const change = (field) => (event) => {
    const value =
      field === 'scenarioId'
        ? event.target.value.toUpperCase()
        : event.target.value;
    setValues((v) => ({ ...v, [field]: value }));
    setFieldErrors((errors) => {
      if (!(field in errors)) return errors;
      const next = { ...errors };
      delete next[field];
      return next;
    });
  };

  async function run(event) {
    event?.preventDefault();
    if (busy.current) return;
    const errors = validatePlanningInput(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      document.getElementById(idFor(Object.keys(errors)[0]))?.focus();
      return;
    }

    busy.current = true;
    controller.current?.abort();
    controller.current = new AbortController();
    setRunning(true);
    setFailure(null);
    try {
      const kind = values.kind;
      const result = await calculatePlanning(
        kind,
        toPlanningRequest(kind, values),
        controller.current.signal
      );
      setOutcome({ kind, result });
      queryClient.invalidateQueries({ queryKey: ['ai', 'runs'] });
    } catch (error) {
      if (isAbortError(error)) return;
      const classified = classifyPlanningError(error);
      setFailure(classified);
      setFieldErrors(classified.fieldErrors);
      setOutcome(null);
    } finally {
      busy.current = false;
      setRunning(false);
    }
  }

  const labels = {
    scenarioId: t('ai.p.scenarioId'),
    stockMode: t('ai.p.stockMode'),
    forecastId: t('ai.r.forecast'),
    supplierScenarioId: t('ai.r.scenario'),
  };

  return (
    <>
      <form className="ai-card" onSubmit={run} noValidate aria-busy={running}>
        <h2>{t('ai.p.title')}</h2>
        <p>{t('ai.p.intro')}</p>

        <fieldset className="ai-row" disabled={running}>
          <legend>{t('ai.p.kind')}</legend>
          {Object.values(PlanningKind).map((kind) => (
            <label key={kind} className="ai-radio">
              <input
                type="radio"
                name="planning-kind"
                value={kind}
                checked={values.kind === kind}
                onChange={change('kind')}
              />
              {t(`ai.p.kinds.${kind}`)}
            </label>
          ))}
        </fieldset>

        <div className="ai-grid">
          <div>
            <label htmlFor={idFor('scenarioId')}>{labels.scenarioId}</label>
            <input
              {...fieldProps('scenarioId', fieldErrors, idFor)}
              type="text"
              value={values.scenarioId}
              onChange={change('scenarioId')}
              placeholder="DEMO-PARTIAL"
              maxLength={64}
              autoComplete="off"
              spellCheck={false}
              disabled={running}
              required
            />
            <FieldError
              id={`${idFor('scenarioId')}-error`}
              error={fieldErrors.scenarioId}
            />
          </div>
          <div>
            <label htmlFor={idFor('stockMode')}>{labels.stockMode}</label>
            <select
              {...fieldProps('stockMode', fieldErrors, idFor)}
              value={values.stockMode}
              onChange={change('stockMode')}
              disabled={running}
            >
              {STOCK_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {t(`ai.p.stockModes.${mode}`)}
                </option>
              ))}
            </select>
            <FieldError
              id={`${idFor('stockMode')}-error`}
              error={fieldErrors.stockMode}
            />
          </div>

          {isRequirements && (
            <>
              <div>
                <label htmlFor={idFor('forecastId')}>{labels.forecastId}</label>
                <select
                  {...fieldProps('forecastId', fieldErrors, idFor)}
                  value={values.forecastId}
                  onChange={change('forecastId')}
                  disabled={running}
                >
                  <option value="">{t('ai.run.latestForecast')}</option>
                  {forecastGroups.map((group) => (
                    <optgroup key={group.key} label={group.name}>
                      {group.versions.map((f) => (
                        <option key={f.id} value={f.id}>
                          {`${f.name} · v${f.version} (${toDay(f.startDate)} → ${toDay(f.endDate)})`}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <FieldError
                  id={`${idFor('forecastId')}-error`}
                  error={fieldErrors.forecastId}
                />
              </div>
              <div>
                <label htmlFor={idFor('supplierScenarioId')}>
                  {labels.supplierScenarioId}
                </label>
                <select
                  {...fieldProps('supplierScenarioId', fieldErrors, idFor)}
                  value={values.supplierScenarioId}
                  onChange={change('supplierScenarioId')}
                  disabled={running}
                >
                  <option value="">{t('ai.run.latestSuppliers')}</option>
                  {(suppliers.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {`${s.name} · v${s.version}`}
                    </option>
                  ))}
                </select>
                <FieldError
                  id={`${idFor('supplierScenarioId')}-error`}
                  error={fieldErrors.supplierScenarioId}
                />
              </div>
            </>
          )}
        </div>
        {isRequirements && (forecasts.error || suppliers.error) && (
          <p className="message message-warning">
            {t('ai.run.listsUnavailable')}
          </p>
        )}

        <div className="ai-row" style={{ marginTop: '1rem' }}>
          <button type="submit" disabled={running}>
            {running ? t('ai.r.executing') : t('ai.r.execute')}
          </button>
          {running && <progress aria-label={t('ai.r.executing')} />}
          {running && <span role="status">{t('ai.run.pending')}</span>}
        </div>

        <FailureMessage failure={failure} onRetry={run} running={running} />
      </form>

      {outcome?.result?.runId && (
        <p className="message message-success" role="status">
          {t('ai.run.saved')}{' '}
          {onOpenRun && (
            <button
              type="button"
              className="secondary"
              onClick={() => onOpenRun(outcome.result.runId)}
            >
              {t('ai.run.openInHistory')}
            </button>
          )}
        </p>
      )}
      {outcome?.kind === PlanningKind.BOM && (
        <BomResult result={outcome.result} />
      )}
      {outcome?.kind === PlanningKind.REQUIREMENTS && (
        <RequirementsResult result={outcome.result} />
      )}
    </>
  );
}

function FailureMessage({ failure, onRetry, running }) {
  const { t } = useTranslation();
  if (!failure) return null;

  switch (failure.state) {
    case 'invalidInput':
      // Field errors are shown under each input; this summary is announced to screen readers.
      return (
        <p className="message message-error" role="alert">
          <strong>{t('ai.p.state.invalidInput')}</strong>
        </p>
      );
    case 'missingInformation':
      return (
        <>
          <p className="message message-error" role="alert">
            <strong>{t('ai.p.state.missingInformation')}</strong>{' '}
            {t('ai.p.state.missingHint')}
          </p>
          <CodeList
            items={failure.problems}
            titleKey="ai.p.problems"
            variant="error"
          />
        </>
      );
    case 'unavailable':
      return (
        <div className="message message-error" role="alert">
          <strong>{t('ai.p.state.unavailable')}</strong>{' '}
          {t('ai.p.state.unavailableHint')}
          {failure.retryAfterSeconds && (
            <> {t('ai.p.retryAfter', { seconds: failure.retryAfterSeconds })}</>
          )}{' '}
          <button
            type="button"
            className="secondary"
            onClick={onRetry}
            disabled={running}
          >
            {t('ai.r.retry')}
          </button>
        </div>
      );
    case 'forbidden':
      return (
        <p className="message message-error" role="alert">
          {t('ai.p.forbidden')}
        </p>
      );
    case 'unauthenticated':
      return (
        <p className="message message-error" role="alert">
          {t('ai.p.loginRequired')}
        </p>
      );
    default:
      return (
        <p className="message message-error" role="alert">
          {t('feedback.errors.unknown')}
        </p>
      );
  }
}
