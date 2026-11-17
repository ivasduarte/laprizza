import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useSession } from '../../../shared/auth/use-session.js';
import { isAbortError } from '../../../shared/api/error-normalizer.js';
import { fieldProps, makeIdFor } from '../../../shared/forms/field-props.js';
import FieldError from '../../../shared/ui/feedback/field-error.jsx';
import { calculatePlanning, PlanningKind } from './planning-api.js';
import { classifyPlanningError, STOCK_MODES, validatePlanningInput } from './planning-errors.js';
import { BomResult, CodeList, RequirementsResult } from './planning-result.jsx';

const idFor = makeIdFor('planning');
// Same permission as the back end (planning:execute); the role is a fallback for older sessions.
const canPlan = (user) =>
  Array.isArray(user?.permissions)
    ? user.permissions.includes('planning:execute')
    : user?.role === 'MANAGER' || (user?.roles ?? []).includes('MANAGER');

/**
 * AI05: runs the BOM / requirements calculation through the back end and shows one of four
 * outcomes: result, invalid input (inline, per field), missing information (problems of the
 * data) or service unavailable (with retry). Nothing is changed: the result is a simulation.
 */
export default function PlanningPanel() {
  const { t } = useTranslation();
  const { status, user } = useSession();

  const [values, setValues] = useState({
    kind: PlanningKind.BOM,
    scenarioId: '',
    stockMode: 'scenario',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [running, setRunning] = useState(false);
  const [failure, setFailure] = useState(null);
  const [outcome, setOutcome] = useState(null); // { kind, result }
  const controller = useRef(null);

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
  if (!canPlan(user)) {
    return (
      <div className="ai-card">
        <p className="message message-error" role="alert">
          {t('ai.p.forbidden')}
        </p>
      </div>
    );
  }

  const change = (field) => (event) => {
    const value = field === 'scenarioId' ? event.target.value.toUpperCase() : event.target.value;
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
    if (running) return;
    const request = { scenarioId: values.scenarioId.trim(), stockMode: values.stockMode };
    const errors = validatePlanningInput(request);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      document.getElementById(idFor(Object.keys(errors)[0]))?.focus();
      return;
    }

    controller.current?.abort();
    controller.current = new AbortController();
    setRunning(true);
    setFailure(null);
    try {
      const result = await calculatePlanning(values.kind, request, controller.current.signal);
      setOutcome({ kind: values.kind, result });
    } catch (error) {
      if (isAbortError(error)) return;
      const classified = classifyPlanningError(error);
      setFailure(classified);
      setFieldErrors(classified.fieldErrors);
      setOutcome(null);
    } finally {
      setRunning(false);
    }
  }

  const labels = {
    scenarioId: t('ai.p.scenarioId'),
    stockMode: t('ai.p.stockMode'),
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
            <FieldError id={`${idFor('scenarioId')}-error`} error={fieldErrors.scenarioId} />
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
            <FieldError id={`${idFor('stockMode')}-error`} error={fieldErrors.stockMode} />
          </div>
        </div>

        <div className="ai-row" style={{ marginTop: '1rem' }}>
          <button type="submit" disabled={running}>
            {t('ai.r.execute')}
          </button>
          {running && <progress aria-label={t('ai.r.executing')} />}
        </div>

        <FailureMessage failure={failure} onRetry={run} running={running} />
      </form>

      {outcome?.kind === PlanningKind.BOM && <BomResult result={outcome.result} />}
      {outcome?.kind === PlanningKind.REQUIREMENTS && <RequirementsResult result={outcome.result} />}
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
            <strong>{t('ai.p.state.missingInformation')}</strong> {t('ai.p.state.missingHint')}
          </p>
          <CodeList items={failure.problems} titleKey="ai.p.problems" variant="error" />
        </>
      );
    case 'unavailable':
      return (
        <div className="message message-error" role="alert">
          <strong>{t('ai.p.state.unavailable')}</strong> {t('ai.p.state.unavailableHint')}
          {failure.retryAfterSeconds && (
            <> {t('ai.p.retryAfter', { seconds: failure.retryAfterSeconds })}</>
          )}{' '}
          <button type="button" className="secondary" onClick={onRetry} disabled={running}>
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
