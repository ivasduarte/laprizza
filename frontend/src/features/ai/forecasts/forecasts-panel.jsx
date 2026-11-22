import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useConfirm,
  useNotify,
} from '../../../shared/feedback/use-feedback.js';
import { useSubmit } from '../../../shared/forms/use-submit.js';
import { errorMessage } from '../../../shared/api/error-text.js';
import {
  aiKeys,
  forecastsApi,
  loadForecastCatalogue,
} from '../shared/ai-api.js';
import { LoadError, VersionLabel } from '../shared/ai-ui.jsx';
import { dash, useFormat } from '../shared/ai-format.js';
import {
  buildProductOptions,
  countDays,
  groupForecasts,
  toDay,
} from './forecast-model.js';
import ForecastForm from './forecast-form.jsx';
import Loading from '../../../shared/ui/feedback/loading.jsx';

/**
 * WEB07 forecasts: list (grouped by name, every active version), detail, create, "edit"
 * (= next version, POST with the same name) and deactivate (PUT isActive:false).
 *
 * @param {{onRun: (forecast) => void}} props - opens the execution with this forecast
 */
export default function ForecastsPanel({ onRun }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const confirm = useConfirm();
  const deactivation = useSubmit();
  // null | { type: 'create' } | { type: 'version', base } | { type: 'view', forecast }
  const [mode, setMode] = useState(null);

  const forecasts = useQuery({
    queryKey: aiKeys.forecasts,
    queryFn: ({ signal }) => forecastsApi.list(signal),
  });
  const catalogue = useQuery({
    queryKey: aiKeys.catalogue,
    queryFn: ({ signal }) => loadForecastCatalogue(signal),
    staleTime: 60_000,
  });
  const options = useMemo(
    () => buildProductOptions(catalogue.data),
    [catalogue.data]
  );
  const groups = useMemo(
    () => groupForecasts(forecasts.data ?? []),
    [forecasts.data]
  );

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: aiKeys.forecasts });

  function saved(forecast) {
    notify({
      type: 'success',
      messageKey: 'ai.fc.saved',
      params: { name: forecast.name, version: forecast.version },
    });
    refresh();
    setMode({ type: 'view', forecast });
  }

  async function deactivate(forecast) {
    const ok = await confirm({
      titleKey: 'ai.fc.deactivateTitle',
      messageKey: 'ai.fc.deactivateConfirm',
      params: { name: forecast.name, version: forecast.version },
      confirmKey: 'ai.fc.deactivate',
      tone: 'danger',
    });
    if (!ok) return;
    const result = await deactivation.submit(
      () => forecastsApi.deactivate(forecast.id),
      {
        successKey: 'ai.fc.deactivated',
        successParams: { name: forecast.name, version: forecast.version },
      }
    );
    // A 404 means it was already deactivated elsewhere: the refreshed list shows the truth.
    if (result.ok || result.error?.kind === 'notFound') {
      if (mode?.forecast?.id === forecast.id) setMode(null);
      refresh();
    }
  }

  const editing = mode?.type === 'create' || mode?.type === 'version';
  const actions = (forecast) => (
    <div className="ai-row">
      <button
        type="button"
        className="secondary"
        onClick={() => setMode({ type: 'view', forecast })}
      >
        {t('ai.view')}
      </button>
      <button
        type="button"
        className="secondary"
        onClick={() => setMode({ type: 'version', base: forecast })}
        disabled={!catalogue.data}
      >
        {t('ai.fc.newVersion')}
      </button>
      <button
        type="button"
        className="danger"
        onClick={() => deactivate(forecast)}
        disabled={deactivation.submitting}
      >
        {t('ai.fc.deactivate')}
      </button>
    </div>
  );

  return (
    <>
      <div className="ai-card">
        <div className="ai-row ai-row-between">
          <h2>{t('ai.f.saved')}</h2>
          <button
            type="button"
            onClick={() => setMode({ type: 'create' })}
            disabled={editing || !catalogue.data}
          >
            {t('ai.f.new')}
          </button>
        </div>
        <p>{t('ai.fc.versionedHint')}</p>

        <LoadError
          error={catalogue.error}
          onRetry={() => catalogue.refetch()}
        />
        <LoadError
          error={forecasts.error}
          onRetry={() => forecasts.refetch()}
        />
        {deactivation.error && (
          <p className="message message-error" role="alert">
            {errorMessage(t, deactivation.error)}
          </p>
        )}

        {forecasts.isPending ? (
          <Loading />
        ) : groups.length === 0 && !forecasts.error ? (
          <p className="message">{t('ai.fc.empty')}</p>
        ) : (
          <div className="ai-scroll">
            <table className="ai-table">
              <thead>
                <tr>
                  <th>{t('ai.f.name')}</th>
                  <th>{t('ai.f.version')}</th>
                  <th>{t('ai.f.period')}</th>
                  <th>{t('ai.fc.entriesCol')}</th>
                  <th>{t('ai.actions')}</th>
                </tr>
              </thead>
              {groups.map((group) => (
                <tbody key={group.key}>
                  {group.versions.map((forecast, index) => (
                    <tr
                      key={forecast.id}
                      className={index > 0 ? 'ai-older' : undefined}
                    >
                      <th scope="row">
                        {index === 0 ? (
                          forecast.name
                        ) : (
                          <span className="visually-hidden">
                            {forecast.name}
                          </span>
                        )}
                      </th>
                      <td>
                        v{forecast.version}{' '}
                        {index === 0 && group.versions.length > 1 && (
                          <span className="ai-tag">{t('ai.fc.latest')}</span>
                        )}
                      </td>
                      <td>
                        {toDay(forecast.startDate)} → {toDay(forecast.endDate)}
                      </td>
                      <td>
                        {t('ai.fc.entriesCount', {
                          count: forecast.entries?.length ?? 0,
                          days: countDays(forecast.entries),
                        })}
                      </td>
                      <td>{actions(forecast)}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </div>

      {editing && (
        <ForecastForm
          key={mode.type === 'version' ? mode.base.id : 'new'}
          options={options}
          base={mode.type === 'version' ? mode.base : null}
          onCancel={() => setMode(null)}
          onSaved={saved}
        />
      )}

      {mode?.type === 'view' && (
        <ForecastDetail
          forecast={mode.forecast}
          options={options}
          sizes={catalogue.data?.sizes ?? []}
          onClose={() => setMode(null)}
          onNewVersion={() => setMode({ type: 'version', base: mode.forecast })}
          onRun={() => onRun?.(mode.forecast)}
        />
      )}
    </>
  );
}

function ForecastDetail({
  forecast,
  options,
  sizes,
  onClose,
  onNewVersion,
  onRun,
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const productName = new Map(options.map((o) => [o.id, o.name]));
  const sizeName = new Map(sizes.map((s) => [String(s.id), s.name]));
  const entries = [...(forecast.entries ?? [])].sort(
    (a, b) =>
      toDay(a.date).localeCompare(toDay(b.date)) ||
      String(productName.get(a.productId) ?? a.productId).localeCompare(
        String(productName.get(b.productId) ?? b.productId)
      )
  );
  const total = entries.reduce((sum, e) => sum + e.quantity, 0);

  return (
    <article className="ai-card" aria-labelledby="forecast-detail-title">
      <div className="ai-row ai-row-between">
        <h2 id="forecast-detail-title">
          <VersionLabel name={forecast.name} version={forecast.version} />
        </h2>
        <div className="ai-row">
          <button type="button" onClick={onRun}>
            {t('ai.fc.runWith')}
          </button>
          <button type="button" className="secondary" onClick={onNewVersion}>
            {t('ai.fc.newVersion')}
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            {t('ai.ui.close')}
          </button>
        </div>
      </div>
      <dl className="ai-meta">
        <div>
          <dt>{t('ai.f.period')}</dt>
          <dd>
            {toDay(forecast.startDate)} → {toDay(forecast.endDate)}
          </dd>
        </div>
        <div>
          <dt>{t('ai.fc.daysWithEntries')}</dt>
          <dd>{f.n(countDays(entries))}</dd>
        </div>
        <div>
          <dt>{t('ai.fc.totalQuantity')}</dt>
          <dd>{f.n(total)}</dd>
        </div>
        <div>
          <dt>ID</dt>
          <dd>
            <code>{forecast.id}</code>
          </dd>
        </div>
      </dl>
      <p className="message">{t('ai.f.omitted')}</p>
      <div className="ai-scroll">
        <table className="ai-table">
          <thead>
            <tr>
              <th>{t('ai.f.date')}</th>
              <th>{t('ai.f.product')}</th>
              <th>{t('ai.f.size')}</th>
              <th>{t('ai.f.quantity')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={`${e.date}-${e.productId}-${e.sizeId ?? ''}`}>
                <td>{toDay(e.date)}</td>
                <td>
                  {productName.get(e.productId) ?? <code>{e.productId}</code>}
                </td>
                <td>
                  {e.sizeId
                    ? (sizeName.get(e.sizeId) ?? <code>{e.sizeId}</code>)
                    : dash(null)}
                </td>
                <td>{f.n(e.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
