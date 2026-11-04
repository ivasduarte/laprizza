import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './ai-page.css';

export default function AiPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('forecasts');
  const [showForm, setShowForm] = useState(false);
  const [executed, setExecuted] = useState(false);
  const [inspected, setInspected] = useState(false);

  const tabs = [
    { id: 'forecasts', label: t('ai.f.title') },
    { id: 'results', label: t('ai.r.title') },
    { id: 'suppliers', label: t('ai.s.title') },
  ];

  return (
    <>
      <h1>{t('ai.title')}</h1>
      <p>{t('ai.intro')}</p>

      <div className="ai-tabs" role="tablist" aria-label={t('ai.sections')}>
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            className="ai-tab"
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* PREVISÕES */}
      {tab === 'forecasts' && (
        <section
          role="tabpanel"
          id="panel-forecasts"
          aria-labelledby="tab-forecasts"
        >
          <div className="ai-card">
            <div className="ai-row">
              <h2>{t('ai.f.saved')}</h2>
              <button type="button" onClick={() => setShowForm(true)}>
                {t('ai.f.new')}
              </button>
            </div>
            <div className="ai-scroll">
              <table className="ai-table">
                <thead>
                  <tr>
                    <th>{t('ai.f.id')}</th>
                    <th>{t('ai.f.name')}</th>
                    <th>{t('ai.f.period')}</th>
                    <th>{t('ai.f.version')}</th>
                    <th>{t('ai.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>—</td>
                    <td>—</td>
                    <td>YYYY-MM-DD → YYYY-MM-DD</td>
                    <td>v1</td>
                    <td>
                      <div className="ai-row">
                        <button type="button" className="secondary">
                          {t('ai.view')}
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => setShowForm(true)}
                        >
                          {t('ai.edit')}
                        </button>
                        <button type="button" className="danger">
                          {t('ai.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {showForm && (
            <form className="ai-card">
              <h2>{t('ai.f.new')}</h2>
              <div className="ai-grid">
                <div>
                  <label htmlFor="fid">{t('ai.f.id')}</label>
                  <input id="fid" type="text" readOnly />
                </div>
                <div>
                  <label htmlFor="fn">{t('ai.f.name')}</label>
                  <input id="fn" type="text" />
                </div>
                <div>
                  <label htmlFor="fs">{t('ai.f.start')}</label>
                  <input id="fs" type="date" />
                </div>
                <div>
                  <label htmlFor="fe">{t('ai.f.end')}</label>
                  <input id="fe" type="date" />
                </div>
              </div>

              <p className="message">{t('ai.f.omitted')}</p>

              <h3>{t('ai.f.entries')}</h3>
              <div className="ai-entry">
                <div>
                  <label htmlFor="d1">{t('ai.f.date')}</label>
                  <input
                    id="d1"
                    type="date"
                    aria-invalid="true"
                    aria-describedby="d1-err"
                  />
                  <p className="field-error" id="d1-err">
                    {t('ai.err.outsidePeriod')}
                  </p>
                </div>
                <div>
                  <label htmlFor="p1">{t('ai.f.product')}</label>
                  <select id="p1" aria-invalid="true" aria-describedby="p1-err">
                    <option>—</option>
                  </select>
                  <p className="field-error" id="p1-err">
                    {t('ai.err.unknownProduct')}
                  </p>
                </div>
                <div>
                  <label htmlFor="z1">{t('ai.f.size')}</label>
                  <select id="z1" aria-invalid="true" aria-describedby="z1-err">
                    <option>—</option>
                  </select>
                  <p className="field-error" id="z1-err">
                    {t('ai.err.incompatibleSize')}
                  </p>
                </div>
                <div>
                  <label htmlFor="q1">{t('ai.f.quantity')}</label>
                  <input
                    id="q1"
                    type="number"
                    min="0"
                    step="1"
                    aria-invalid="true"
                    aria-describedby="q1-err"
                  />
                  <p className="field-error" id="q1-err">
                    {t('ai.err.quantity')}
                  </p>
                </div>
                <button
                  type="button"
                  className="danger"
                  style={{ marginTop: '1.7rem' }}
                >
                  {t('ai.remove')}
                </button>
              </div>
              <button type="button" className="secondary">
                {t('ai.f.addEntry')}
              </button>

              <div className="message message-error" role="alert">
                <strong>{t('ai.err.summary')}</strong>
                <ul>
                  <li>{t('ai.err.duplicate')}</li>
                </ul>
              </div>

              <div className="ai-row" style={{ marginTop: '1rem' }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowForm(false)}
                >
                  {t('ai.cancel')}
                </button>
                <button type="submit">{t('ai.save')}</button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* EXECUÇÃO E RESULTADOS */}
      {tab === 'results' && (
        <section
          role="tabpanel"
          id="panel-results"
          aria-labelledby="tab-results"
        >
          <div className="ai-card">
            <div className="ai-grid">
              <div>
                <label htmlFor="xf">{t('ai.r.forecast')}</label>
                <select id="xf">
                  <option>—</option>
                </select>
              </div>
              <div>
                <label htmlFor="xd">{t('ai.r.referenceDate')}</label>
                <input id="xd" type="date" />
              </div>
            </div>
            <div className="ai-row" style={{ marginTop: '1rem' }}>
              <button type="button" onClick={() => setExecuted(true)}>
                {t('ai.r.execute')}
              </button>
              <progress aria-label={t('ai.r.executing')} />
            </div>
            {executed && (
              <div className="message message-error" role="alert">
                <strong>{t('ai.r.errorTitle')}</strong> {t('ai.r.errorText')}{' '}
                <button type="button" className="secondary">
                  {t('ai.r.retry')}
                </button>
              </div>
            )}
          </div>

          {executed && (
            <article className="ai-card">
              <div className="ai-row">
                <h2>{t('ai.r.resultOf')}</h2>
                <span className="ai-tag">{t('ai.r.simulation')}</span>
              </div>
              <p className="message message-warning">
                {t('ai.r.noStockChange')}
              </p>
              <dl className="ai-meta">
                <div>
                  <dt>{t('ai.r.forecastVersion')}</dt>
                  <dd>—</dd>
                </div>
                <div>
                  <dt>{t('ai.r.stockSnapshot')}</dt>
                  <dd>—</dd>
                </div>
                <div>
                  <dt>{t('ai.r.bom')}</dt>
                  <dd>—</dd>
                </div>
                <div>
                  <dt>{t('ai.r.scenario')}</dt>
                  <dd>—</dd>
                </div>
                <div>
                  <dt>{t('ai.r.referenceDate')}</dt>
                  <dd>—</dd>
                </div>
                <div>
                  <dt>{t('ai.r.executedAt')}</dt>
                  <dd>—</dd>
                </div>
              </dl>

              <h3>{t('ai.r.dailyPlan')}</h3>
              <div className="ai-scroll">
                <table className="ai-table">
                  <thead>
                    <tr>
                      <th>{t('ai.r.col.day')}</th>
                      <th>{t('ai.r.col.item')}</th>
                      <th>{t('ai.r.col.required')}</th>
                      <th>{t('ai.r.col.inStock')}</th>
                      <th>{t('ai.r.col.remaining')}</th>
                      <th>{t('ai.r.col.replenish')}</th>
                      <th>{t('ai.r.col.supplier')}</th>
                      <th>{t('ai.r.col.orderOn')}</th>
                      <th>{t('ai.r.col.delivery')}</th>
                      <th>{t('ai.r.col.unmet')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td>
                        <span className="ai-tag">{t('ai.noSupplier')}</span>
                      </td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3>{t('ai.r.selectionTitle')}</h3>
              <p className="message">{t('ai.r.selectionHint')}</p>

              <div className="message message-warning">
                <strong>{t('ai.r.warnings')}</strong>
                <ul>
                  <li>{t('ai.r.warningSample')}</li>
                </ul>
              </div>
            </article>
          )}

          <div className="ai-card">
            <h2>{t('ai.r.previous')}</h2>
            <table className="ai-table">
              <thead>
                <tr>
                  <th>{t('ai.r.executedAt')}</th>
                  <th>{t('ai.r.forecastVersion')}</th>
                  <th>{t('ai.r.scenario')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>—</td>
                  <td>v1</td>
                  <td>—</td>
                  <td>
                    <button type="button" className="secondary">
                      {t('ai.view')}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* CENÁRIO DE FORNECEDORES (inclui exportação de produtos) */}
      {tab === 'suppliers' && (
        <section
          role="tabpanel"
          id="panel-suppliers"
          aria-labelledby="tab-suppliers"
        >
          <div className="ai-card">
            <h2>{t('ai.e.title')}</h2>
            <p>{t('ai.e.desc')}</p>
            <button type="button">{t('ai.e.button')}</button>
          </div>

          <div className="ai-card">
            <details>
              <summary>
                <strong>{t('ai.s.format')}</strong>
              </summary>
              <pre className="ai-code">{`{
  "suppliers": [ { "id": "S-01", "name": "..." } ],
  "products": [ {
    "productId": "...",
    "offers": [ { "supplierId": "S-01", "priceEur": 0, "stockUnits": 1, "leadTimeDays": 0, "supplyLimit": 0 } ]
  } ]
}`}</pre>
              <p>{t('ai.s.formatHelp')}</p>
              <button type="button" className="secondary">
                {t('ai.s.downloadExample')}
              </button>
            </details>
          </div>

          <div className="ai-card">
            <h2>{t('ai.s.step1')}</h2>
            <label htmlFor="sj">{t('ai.s.json')}</label>
            <textarea
              id="sj"
              rows={10}
              style={{ width: '100%', fontFamily: 'monospace' }}
            />
            <div className="ai-row" style={{ marginTop: '0.5rem' }}>
              <input
                id="sf"
                type="file"
                accept="application/json,.json"
                aria-label={t('ai.s.chooseFile')}
              />
              <button type="button" onClick={() => setInspected(true)}>
                {t('ai.s.inspect')}
              </button>
            </div>

            {inspected && (
              <div className="message message-error" role="alert">
                <strong>
                  {t('ai.s.errorsTitle')} {t('ai.s.previousKept')}
                </strong>
                <ul>
                  <li>{t('ai.s.errorSample')}</li>
                </ul>
              </div>
            )}
          </div>

          {inspected && (
            <div className="ai-card">
              <h2>{t('ai.s.step2')}</h2>
              <p className="message message-success">{t('ai.s.valid')}</p>
              <div className="ai-scroll">
                <table className="ai-table">
                  <thead>
                    <tr>
                      <th>{t('ai.s.col.product')}</th>
                      <th>{t('ai.s.col.supplier')}</th>
                      <th>{t('ai.s.col.price')}</th>
                      <th>{t('ai.s.col.units')}</th>
                      <th>{t('ai.s.col.unitPrice')}</th>
                      <th>{t('ai.s.col.lead')}</th>
                      <th>{t('ai.s.col.limit')}</th>
                      <th>{t('ai.s.col.origin')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td>
                        <span className="ai-tag">{t('ai.r.simulation')}</span>
                      </td>
                    </tr>
                    <tr>
                      <td>—</td>
                      <td colSpan={7}>
                        <span className="ai-tag">{t('ai.noSupplier')}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="ai-row" style={{ marginTop: '1rem' }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setInspected(false)}
                >
                  {t('ai.s.discard')}
                </button>
                <button type="button">{t('ai.s.confirm')}</button>
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}
