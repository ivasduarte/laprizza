import { useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useConfirm,
  useNotify,
} from '../../../shared/feedback/use-feedback.js';
import { useSubmit } from '../../../shared/forms/use-submit.js';
import { errorMessage, fieldMessage } from '../../../shared/api/error-text.js';
import { aiDataApi, aiKeys, supplierScenariosApi } from '../shared/ai-api.js';
import { aiViolations } from '../shared/ai-errors.js';
import { LoadError, VersionLabel } from '../shared/ai-ui.jsx';
import { downloadJson, today } from '../shared/ai-format.js';
import {
  buildExample,
  parseSupplierJson,
  toScenarioPayload,
  validateScenarioStructure,
} from './supplier-model.js';
import SupplierPreview from './supplier-preview.jsx';

/**
 * WEB07 suppliers: product export (input for the supplier file), JSON format and LLM help,
 * two-step import (inspect = local checks + server dry-run, then confirm) and the saved
 * scenarios. A rejected file never replaces the dataset in use.
 */
export default function SuppliersPanel() {
  const { t } = useTranslation();
  const exported = useQuery({
    queryKey: aiKeys.productsExport,
    queryFn: ({ signal }) => aiDataApi.exportProducts(signal),
    staleTime: 60_000,
  });
  const products = exported.data?.products ?? [];

  return (
    <>
      <ExportCard query={exported} />
      <FormatCard products={products} />
      <ImportCard products={products} />
      <ScenariosCard products={products} />
      {exported.error && (
        <div className="ai-card">
          <p>{t('ai.sp.exportNeeded')}</p>
          <LoadError
            error={exported.error}
            onRetry={() => exported.refetch()}
          />
        </div>
      )}
    </>
  );
}

function ExportCard({ query }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  // Always a fresh export: the file is the input of the supplier/LLM preparation.
  async function download() {
    if (busy) return;
    setBusy(true);
    const { data } = await query.refetch();
    setBusy(false);
    if (data) downloadJson(data, `laprizza-products-${today()}.json`);
  }

  return (
    <div className="ai-card">
      <h2>{t('ai.e.title')}</h2>
      <p>{t('ai.e.desc')}</p>
      <div className="ai-row">
        <button type="button" onClick={download} disabled={busy}>
          {t('ai.e.button')}
        </button>
        {query.data && (
          <span>
            {t('ai.sp.exportCount', {
              count: query.data.products?.length ?? 0,
            })}
          </span>
        )}
      </div>
    </div>
  );
}

function FormatCard({ products }) {
  const { t } = useTranslation();
  const notify = useNotify();
  const example = useMemo(() => buildExample(products), [products]);
  const prompt = t('ai.sp.llmPrompt');

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      notify({ type: 'success', messageKey: 'ai.sp.copied' });
    } catch {
      notify({ type: 'error', messageKey: 'ai.sp.copyFailed' });
    }
  }

  return (
    <div className="ai-card">
      <details>
        <summary>
          <strong>{t('ai.s.format')}</strong>
        </summary>
        <p>{t('ai.s.formatHelp')}</p>
        <pre className="ai-code">{JSON.stringify(example, null, 2)}</pre>
        <button
          type="button"
          className="secondary"
          onClick={() =>
            downloadJson(example, 'laprizza-suppliers-example.json')
          }
        >
          {t('ai.s.downloadExample')}
        </button>
        <h3>{t('ai.sp.llmTitle')}</h3>
        <p>{t('ai.sp.llmHelp')}</p>
        <pre className="ai-code ai-prompt">{prompt}</pre>
        <button type="button" className="secondary" onClick={copyPrompt}>
          {t('ai.sp.copyPrompt')}
        </button>
      </details>
    </div>
  );
}

function ImportCard({ products }) {
  const { t } = useTranslation();
  const ids = useId();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const fileInput = useRef(null);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [problems, setProblems] = useState(null); // { titleKey, violations }
  const [inspected, setInspected] = useState(null); // { payload, nextVersion }
  const inspection = useSubmit();
  const saving = useSubmit();
  const busy = inspection.submitting || saving.submitting;

  // Any change invalidates the inspection: only what was inspected can be confirmed.
  const edit = (setter) => (value) => {
    setter(value);
    setInspected(null);
    setProblems(null);
  };

  async function readFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    edit(setText)(await file.text());
  }

  const rejected = (error) =>
    error.kind === 'validation'
      ? (() => {
          const { fieldErrors, formErrors } = aiViolations(error);
          return {
            titleKey: 'ai.s.errorsTitle',
            violations: [...fieldErrors, ...formErrors],
          };
        })()
      : { message: errorMessage(t, error) };

  async function inspect(event) {
    event.preventDefault();
    if (busy) return;
    setInspected(null);
    const parsed = parseSupplierJson(text);
    if (!parsed.ok) {
      return setProblems({
        titleKey: 'ai.s.errorsTitle',
        violations: [{ field: '', ...parsed.error }],
      });
    }
    const payload = toScenarioPayload(parsed.data, name);
    if (!name.trim() && payload.name) setName(payload.name);
    const local = validateScenarioStructure(payload);
    if (local.length > 0)
      return setProblems({ titleKey: 'ai.s.errorsTitle', violations: local });

    const result = await inspection.submit(() =>
      supplierScenariosApi.validate(payload)
    );
    if (result.ok) {
      setProblems(null);
      setInspected({ payload, nextVersion: result.value.nextVersion });
    } else if (result.error) {
      setProblems(rejected(result.error));
    }
  }

  async function confirmImport() {
    if (busy || !inspected) return;
    const result = await saving.submit(() =>
      supplierScenariosApi.create(inspected.payload)
    );
    if (result.ok) {
      notify({
        type: 'success',
        messageKey: 'ai.sp.saved',
        params: { name: result.value.name, version: result.value.version },
      });
      queryClient.invalidateQueries({ queryKey: aiKeys.suppliers });
      setInspected(null);
      setText('');
      setName('');
      if (fileInput.current) fileInput.current.value = '';
    } else if (result.error) {
      setInspected(null);
      setProblems(rejected(result.error));
    }
  }

  return (
    <>
      <form className="ai-card" onSubmit={inspect} noValidate aria-busy={busy}>
        <h2>{t('ai.s.step1')}</h2>
        <fieldset className="ai-fieldset" disabled={busy}>
          <div className="ai-grid">
            <div>
              <label htmlFor={`${ids}-name`}>{t('ai.sp.name')}</label>
              <input
                id={`${ids}-name`}
                type="text"
                value={name}
                maxLength={100}
                onChange={(e) => edit(setName)(e.target.value)}
                aria-describedby={`${ids}-name-hint`}
              />
              <p className="field-hint" id={`${ids}-name-hint`}>
                {t('ai.sp.nameHint')}
              </p>
            </div>
            <div>
              <label htmlFor={`${ids}-file`}>{t('ai.s.chooseFile')}</label>
              <input
                ref={fileInput}
                id={`${ids}-file`}
                type="file"
                accept="application/json,.json"
                onChange={readFile}
              />
            </div>
          </div>
          <label htmlFor={`${ids}-json`}>{t('ai.s.json')}</label>
          <textarea
            id={`${ids}-json`}
            className="ai-json"
            rows={12}
            spellCheck={false}
            value={text}
            onChange={(e) => edit(setText)(e.target.value)}
          />
        </fieldset>
        <div className="ai-row ai-form-actions">
          <button type="submit" disabled={busy || !text.trim()}>
            {inspection.submitting ? t('ai.sp.inspecting') : t('ai.s.inspect')}
          </button>
        </div>

        {problems?.violations && (
          <div className="message message-error" role="alert">
            <strong>{t(problems.titleKey)}</strong> {t('ai.s.previousKept')}
            <ul>
              {problems.violations.map((v, i) => (
                <li key={`${v.field}-${v.type}-${i}`}>
                  {v.field && <code className="ai-subject">{v.field}</code>}{' '}
                  {fieldMessage(t, v)}
                  {v.line && (
                    <>
                      {' '}
                      {t('ai.sp.atLine', { line: v.line, column: v.column })}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {problems?.message && (
          <p className="message message-error" role="alert">
            {problems.message} {t('ai.s.previousKept')}
          </p>
        )}
      </form>

      {inspected && (
        <section className="ai-card" aria-labelledby={`${ids}-preview`}>
          <div className="ai-row">
            <h2 id={`${ids}-preview`}>{t('ai.s.step2')}</h2>
            <span className="ai-tag">{t('ai.sp.simulated')}</span>
          </div>
          <p className="message message-success" role="status">
            {t('ai.sp.validAs', {
              name: inspected.payload.name,
              version: inspected.nextVersion,
            })}
          </p>
          <SupplierPreview scenario={inspected.payload} exported={products} />
          <div className="ai-row ai-form-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => setInspected(null)}
              disabled={saving.submitting}
            >
              {t('ai.s.discard')}
            </button>
            <button
              type="button"
              onClick={confirmImport}
              disabled={saving.submitting}
            >
              {saving.submitting ? t('ai.ui.saving') : t('ai.s.confirm')}
            </button>
          </div>
        </section>
      )}
    </>
  );
}

function ScenariosCard({ products }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const deactivation = useSubmit();
  const [viewing, setViewing] = useState(null);
  const scenarios = useQuery({
    queryKey: aiKeys.suppliers,
    queryFn: ({ signal }) => supplierScenariosApi.list(signal),
  });
  const list = [...(scenarios.data ?? [])].sort(
    (a, b) => a.name.localeCompare(b.name) || b.version - a.version
  );

  async function deactivate(scenario) {
    const ok = await confirm({
      titleKey: 'ai.sp.deactivateTitle',
      messageKey: 'ai.sp.deactivateConfirm',
      params: { name: scenario.name, version: scenario.version },
      confirmKey: 'ai.fc.deactivate',
      tone: 'danger',
    });
    if (!ok) return;
    const result = await deactivation.submit(
      () => supplierScenariosApi.deactivate(scenario.id),
      {
        successKey: 'ai.sp.deactivated',
        successParams: { name: scenario.name, version: scenario.version },
      }
    );
    if (result.ok || result.error?.kind === 'notFound') {
      if (viewing?.id === scenario.id) setViewing(null);
      queryClient.invalidateQueries({ queryKey: aiKeys.suppliers });
    }
  }

  return (
    <div className="ai-card">
      <h2>{t('ai.sp.savedTitle')}</h2>
      <p>{t('ai.sp.savedHint')}</p>
      <LoadError error={scenarios.error} onRetry={() => scenarios.refetch()} />
      {deactivation.error && (
        <p className="message message-error" role="alert">
          {errorMessage(t, deactivation.error)}
        </p>
      )}
      {scenarios.isPending ? (
        <p role="status">{t('layout.loading')}</p>
      ) : list.length === 0 && !scenarios.error ? (
        <p className="message">{t('ai.sp.empty')}</p>
      ) : (
        <div className="ai-scroll">
          <table className="ai-table">
            <thead>
              <tr>
                <th>{t('ai.f.name')}</th>
                <th>{t('ai.f.version')}</th>
                <th>{t('ai.sp.suppliersCol')}</th>
                <th>{t('ai.sp.productsCol')}</th>
                <th>{t('ai.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <th scope="row">{s.name}</th>
                  <td>v{s.version}</td>
                  <td>{s.suppliers.length}</td>
                  <td>{s.products.length}</td>
                  <td>
                    <div className="ai-row">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setViewing(s)}
                      >
                        {t('ai.view')}
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => deactivate(s)}
                        disabled={deactivation.submitting}
                      >
                        {t('ai.fc.deactivate')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewing && (
        <section aria-labelledby="supplier-detail-title">
          <div className="ai-row ai-row-between">
            <h3 id="supplier-detail-title">
              <VersionLabel name={viewing.name} version={viewing.version} />{' '}
              <span className="ai-tag">{t('ai.sp.simulated')}</span>
            </h3>
            <button
              type="button"
              className="secondary"
              onClick={() => setViewing(null)}
            >
              {t('ai.ui.close')}
            </button>
          </div>
          <SupplierPreview scenario={viewing} exported={products} />
        </section>
      )}
    </div>
  );
}
