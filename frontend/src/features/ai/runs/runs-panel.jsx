import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { aiKeys, forecastsApi, planningRunsApi } from '../shared/ai-api.js';
import { LoadError, VersionLabel } from '../shared/ai-ui.jsx';
import { dash, useFormat } from '../shared/ai-format.js';
import { groupForecasts } from '../forecasts/forecast-model.js';
import { BomResult, RequirementsResult } from '../planning/planning-result.jsx';
import Loading from '../../../shared/ui/feedback/loading.jsx';

/**
 * WEB07 saved results (`/planning/runs`). Every run keeps the forecast version, the supplier
 * scenario version, the stock snapshot and the BOM version it was calculated with, so editing
 * a forecast (= new version) never changes a previous result.
 *
 * @param {{openRunId?: string|null}} props - run to open (e.g. right after a calculation)
 */
export default function RunsPanel({ openRunId = null }) {
  const { t } = useTranslation();
  const f = useFormat();
  const [forecastId, setForecastId] = useState('');
  const [selected, setSelected] = useState(openRunId);

  const filters = useMemo(
    () => ({ kind: 'requirements', ...(forecastId ? { forecastId } : {}) }),
    [forecastId]
  );
  const runs = useQuery({
    queryKey: aiKeys.runs(filters),
    queryFn: ({ signal }) => planningRunsApi.list(filters, signal),
  });
  // Deactivated forecasts are not listed, but their runs are: the filter only offers active ones.
  const forecasts = useQuery({
    queryKey: aiKeys.forecasts,
    queryFn: ({ signal }) => forecastsApi.list(signal),
  });
  const groups = useMemo(
    () => groupForecasts(forecasts.data ?? []),
    [forecasts.data]
  );

  return (
    <>
      <div className="ai-card">
        <div className="ai-row ai-row-between">
          <h2>{t('ai.r.previous')}</h2>
          <div>
            <label htmlFor="runs-forecast">{t('ai.run.filterForecast')}</label>{' '}
            <select
              id="runs-forecast"
              value={forecastId}
              onChange={(e) => setForecastId(e.target.value)}
            >
              <option value="">{t('ai.run.allForecasts')}</option>
              {groups.map((g) => (
                <optgroup key={g.key} label={g.name}>
                  {g.versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {`${v.name} · v${v.version}`}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
        <p className="message message-warning">{t('ai.r.noStockChange')}</p>
        <LoadError error={runs.error} onRetry={() => runs.refetch()} />

        {runs.isPending ? (
          <Loading />
        ) : (runs.data ?? []).length === 0 && !runs.error ? (
          <p className="message">{t('ai.run.empty')}</p>
        ) : (
          <div className="ai-scroll">
            <table className="ai-table">
              <thead>
                <tr>
                  <th>{t('ai.r.executedAt')}</th>
                  <th>{t('ai.r.forecastVersion')}</th>
                  <th>{t('ai.r.scenario')}</th>
                  <th>{t('ai.r.stockSnapshot')}</th>
                  <th>{t('ai.r.bom')}</th>
                  <th>{t('ai.run.stockSource')}</th>
                  <th>{t('ai.p.totalCost')}</th>
                  <th>{t('ai.run.feasibility')}</th>
                  <th>{t('ai.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {runs.data.map((run) => (
                  <tr
                    key={run.id}
                    aria-current={run.id === selected ? 'true' : undefined}
                  >
                    <td>{f.at(run.createdAt)}</td>
                    <td>
                      {run.forecast ? (
                        <VersionLabel
                          name={run.forecast.name}
                          version={run.forecast.version}
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {run.supplierScenario ? (
                        <VersionLabel
                          name={run.supplierScenario.name}
                          version={run.supplierScenario.version}
                        />
                      ) : (
                        <span className="ai-tag ai-tag-warn">
                          {t('ai.run.noSuppliers')}
                        </span>
                      )}
                    </td>
                    <td>
                      <code>{dash(run.snapshotId)}</code>
                    </td>
                    <td>
                      <code>{dash(run.bomVersion)}</code>
                    </td>
                    <td>
                      {t(`ai.run.sources.${run.stockSource?.source}`, {
                        defaultValue: '—',
                      })}
                    </td>
                    <td>{f.eur(run.summary?.totalCostEur)}</td>
                    <td>
                      <Feasible value={run.feasible ?? run.summary?.feasible} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setSelected(run.id)}
                      >
                        {t('ai.view')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <RunDetail id={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function Feasible({ value }) {
  const { t } = useTranslation();
  if (typeof value !== 'boolean') return '—';
  return (
    <span className={`ai-tag ${value ? 'ai-tag-ok' : 'ai-tag-warn'}`}>
      {t(value ? 'ai.p.feasible' : 'ai.run.notFeasible')}
    </span>
  );
}

function RunDetail({ id, onClose }) {
  const { t } = useTranslation();
  const f = useFormat();
  const run = useQuery({
    queryKey: aiKeys.run(id),
    queryFn: ({ signal }) => planningRunsApi.get(id, signal),
    staleTime: Infinity, // a saved run never changes
  });

  if (run.isPending) return <Loading />;
  if (run.error)
    return (
      <div className="ai-card">
        <LoadError error={run.error} onRetry={() => run.refetch()} />
      </div>
    );

  const data = run.data;
  return (
    <section aria-labelledby="run-detail-title">
      <div className="ai-card">
        <div className="ai-row ai-row-between">
          <h2 id="run-detail-title">
            {t('ai.run.detailTitle', { date: f.at(data.createdAt) })}
          </h2>
          <button type="button" className="secondary" onClick={onClose}>
            {t('ai.ui.close')}
          </button>
        </div>
        <dl className="ai-meta">
          <div>
            <dt>{t('ai.r.forecastVersion')}</dt>
            <dd>
              {data.forecast ? (
                <VersionLabel
                  name={data.forecast.name}
                  version={data.forecast.version}
                />
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt>{t('ai.r.scenario')}</dt>
            <dd>
              {data.supplierScenario ? (
                <VersionLabel
                  name={data.supplierScenario.name}
                  version={data.supplierScenario.version}
                />
              ) : (
                t('ai.run.noSuppliers')
              )}
            </dd>
          </div>
          <div>
            <dt>{t('ai.r.stockSnapshot')}</dt>
            <dd>
              <code>{dash(data.snapshotId)}</code>
            </dd>
          </div>
          <div>
            <dt>{t('ai.r.bom')}</dt>
            <dd>
              <code>{dash(data.bomVersion)}</code>
            </dd>
          </div>
          <div>
            <dt>{t('ai.run.stockSource')}</dt>
            <dd>
              {t(`ai.run.sources.${data.stockSource?.source}`, {
                defaultValue: '—',
              })}
            </dd>
          </div>
          <div>
            <dt>{t('ai.run.aiScenario')}</dt>
            <dd>
              <code>{dash(data.request?.scenarioId)}</code>
            </dd>
          </div>
        </dl>
      </div>
      {data.kind === 'bom' ? (
        <BomResult result={data.result} />
      ) : (
        <RequirementsResult result={data.result} />
      )}
    </section>
  );
}
