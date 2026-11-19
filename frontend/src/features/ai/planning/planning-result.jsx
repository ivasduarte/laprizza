import { useTranslation } from 'react-i18next';
import { problemSubjects } from './planning-errors.js';

const dash = (value) => (value === null || value === undefined ? '—' : value);

function useFormatters() {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const number = new Intl.NumberFormat(locale);
  const money = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
  });
  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'medium',
  });
  return {
    n: (v) => (typeof v === 'number' ? number.format(v) : dash(v)),
    eur: (v) => (typeof v === 'number' ? money.format(v) : '—'),
    at: (v) => {
      const d = v ? new Date(v) : null;
      return d && !Number.isNaN(d.getTime()) ? dateTime.format(d) : '—';
    },
  };
}

/** Translated text of a problem or warning code; unknown codes are shown as they are. */
export function CodeList({ items, titleKey, variant }) {
  const { t } = useTranslation();
  if (!items?.length) return null;
  return (
    <div
      className={`message message-${variant}`}
      role={variant === 'error' ? 'alert' : undefined}
    >
      <strong>{t(titleKey)}</strong>
      <ul>
        {items.map((item, index) => {
          const subjects = problemSubjects(item);
          return (
            <li key={`${item.code}-${index}`}>
              {t(`ai.p.codes.${item.code}`, { defaultValue: item.code })}
              {subjects.length > 0 && (
                <code className="ai-subject"> {subjects.join(' · ')}</code>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ResultHeader({ result, title }) {
  const { t } = useTranslation();
  const f = useFormatters();
  const feasible = result.feasible ?? result.summary?.feasible;
  return (
    <>
      <div className="ai-row">
        <h2>{title}</h2>
        <span className="ai-tag">{t('ai.r.simulation')}</span>
        {typeof feasible === 'boolean' && (
          <span className={`ai-tag ${feasible ? 'ai-tag-ok' : 'ai-tag-warn'}`}>
            {t(feasible ? 'ai.p.feasible' : 'ai.p.notFeasible')}
          </span>
        )}
      </div>
      <p className="message message-warning">{t('ai.r.noStockChange')}</p>
      <dl className="ai-meta">
        <div>
          <dt>{t('ai.p.scenario')}</dt>
          <dd>
            {dash(result.scenario?.name)} ({dash(result.scenario?.id)} v
            {dash(result.scenario?.version)})
          </dd>
        </div>
        <div>
          <dt>{t('ai.p.stockMode')}</dt>
          <dd>
            {t(`ai.p.stockModes.${result.scenario?.stockMode}`, {
              defaultValue: '—',
            })}
          </dd>
        </div>
        <div>
          <dt>{t('ai.r.stockSnapshot')}</dt>
          <dd>
            <code>{dash(result.inputs?.snapshotId)}</code>
          </dd>
        </div>
        <div>
          <dt>{t('ai.r.executedAt')}</dt>
          <dd>{f.at(result.calculatedAt)}</dd>
        </div>
      </dl>
    </>
  );
}

export function BomResult({ result }) {
  const { t } = useTranslation();
  const f = useFormatters();
  return (
    <article className="ai-card" aria-labelledby="planning-result-title">
      <ResultHeader
        result={result}
        title={<span id="planning-result-title">{t('ai.p.bomTitle')}</span>}
      />

      <h3>{t('ai.p.items')}</h3>
      <div className="ai-scroll">
        <table className="ai-table">
          <thead>
            <tr>
              <th>{t('ai.r.col.item')}</th>
              <th>{t('ai.p.col.kind')}</th>
              <th>{t('ai.r.col.required')}</th>
              <th>{t('ai.r.col.inStock')}</th>
              <th>{t('ai.p.col.used')}</th>
              <th>{t('ai.r.col.remaining')}</th>
              <th>{t('ai.p.col.shortage')}</th>
            </tr>
          </thead>
          <tbody>
            {(result.items ?? []).map((item) => (
              <tr key={item.productId}>
                <td>{item.name}</td>
                <td>
                  {t(`ai.p.kinds.${item.kind}`, { defaultValue: item.kind })}
                </td>
                <td>{f.n(item.required)}</td>
                <td>
                  {item.stockControlled
                    ? f.n(item.available)
                    : t('ai.p.notControlled')}
                </td>
                <td>{f.n(item.used)}</td>
                <td>{f.n(item.remaining)}</td>
                <td className={item.shortage > 0 ? 'ai-shortage' : undefined}>
                  {f.n(item.shortage)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result.production?.length > 0 && (
        <>
          <h3>{t('ai.p.production')}</h3>
          <ul>
            {result.production.map((p) => (
              <li key={p.productId}>
                {p.name}: {f.n(p.toProduce)}{' '}
                {p.canProduce ? (
                  <span className="ai-tag ai-tag-ok">
                    {t('ai.p.canProduce')}
                  </span>
                ) : (
                  <span className="ai-tag ai-tag-warn">
                    {t('ai.p.missingIngredients', {
                      items: p.missingIngredients.map((m) => m.name).join(', '),
                    })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {result.shortages?.length > 0 && (
        <>
          <h3>{t('ai.p.replenishment')}</h3>
          <ul>
            {result.shortages.map((s) => (
              <li key={s.productId}>
                {s.name}: {f.n(s.replenishmentNeeded)}
              </li>
            ))}
          </ul>
        </>
      )}

      <CodeList
        items={result.warnings}
        titleKey="ai.r.warnings"
        variant="warning"
      />
    </article>
  );
}

/** Net need of every item per day (`requirements[].needs`), ordered by date. */
function DailyNeeds({ requirements = [] }) {
  const { t } = useTranslation();
  const f = useFormatters();
  const rows = requirements
    .flatMap((r) =>
      (r.needs ?? []).map((n) => ({
        ...n,
        productId: r.productId,
        name: r.name,
      }))
    )
    .filter((n) => n.quantity > 0)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        String(a.name).localeCompare(String(b.name))
    );
  return (
    <>
      <h3>{t('ai.run.dailyNeeds')}</h3>
      {rows.length === 0 ? (
        <p className="message">{t('ai.run.noDailyNeeds')}</p>
      ) : (
        <div className="ai-scroll">
          <table className="ai-table">
            <thead>
              <tr>
                <th>{t('ai.r.col.day')}</th>
                <th>{t('ai.r.col.item')}</th>
                <th>{t('ai.run.need')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => (
                <tr key={`${n.date}-${n.productId}`}>
                  <td>{n.date}</td>
                  <td>{n.name}</td>
                  <td>{f.n(n.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function RequirementsResult({ result }) {
  const { t } = useTranslation();
  const f = useFormatters();
  const plan = result.plan ?? {};
  const rows = (result.purchases ?? []).flatMap((purchase) => [
    ...(purchase.allocations ?? []).map((a, i) => ({
      key: `${purchase.productId}-a${i}`,
      purchase,
      a,
    })),
    ...(purchase.unmet ?? []).map((u, i) => ({
      key: `${purchase.productId}-u${i}`,
      purchase,
      u,
    })),
  ]);

  return (
    <article className="ai-card" aria-labelledby="planning-result-title">
      <ResultHeader
        result={result}
        title={
          <span id="planning-result-title">{t('ai.p.requirementsTitle')}</span>
        }
      />
      <dl className="ai-meta">
        <div>
          <dt>{t('ai.r.forecastVersion')}</dt>
          <dd>
            {dash(plan.forecastName)} v{dash(plan.version)}
          </dd>
        </div>
        <div>
          <dt>{t('ai.f.period')}</dt>
          <dd>
            {dash(plan.startDate)} → {dash(plan.endDate)}
          </dd>
        </div>
        <div>
          <dt>{t('ai.r.referenceDate')}</dt>
          <dd>{dash(plan.referenceDate)}</dd>
        </div>
        <div>
          <dt>{t('ai.p.totalCost')}</dt>
          <dd>{f.eur(result.summary?.totalCostEur)}</dd>
        </div>
      </dl>

      <h3>{t('ai.p.items')}</h3>
      <div className="ai-scroll">
        <table className="ai-table">
          <thead>
            <tr>
              <th>{t('ai.r.col.item')}</th>
              <th>{t('ai.r.col.required')}</th>
              <th>{t('ai.r.col.inStock')}</th>
              <th>{t('ai.p.col.shortage')}</th>
            </tr>
          </thead>
          <tbody>
            {(result.requirements ?? []).map((r) => (
              <tr key={r.productId}>
                <td>{r.name}</td>
                <td>{f.n(r.required)}</td>
                <td>
                  {r.stockControlled
                    ? f.n(r.available)
                    : t('ai.p.notControlled')}
                </td>
                <td className={r.shortage > 0 ? 'ai-shortage' : undefined}>
                  {f.n(r.shortage)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DailyNeeds requirements={result.requirements} />

      {result.production?.length > 0 && (
        <>
          <h3>{t('ai.p.production')}</h3>
          <ul>
            {result.production.map((p) => (
              <li key={p.productId}>
                {p.name}: {f.n(p.toProduce)}{' '}
                {(p.schedule ?? []).length > 0 && (
                  <span className="ai-subject">
                    (
                    {p.schedule
                      .map((s) => `${s.date}: ${f.n(s.quantity)}`)
                      .join(' · ')}
                    )
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {result.purchases?.length > 0 && (
        <>
          <h3>{t('ai.run.purchases')}</h3>
          <div className="ai-scroll">
            <table className="ai-table">
              <thead>
                <tr>
                  <th>{t('ai.r.col.item')}</th>
                  <th>{t('ai.p.col.shortage')}</th>
                  <th>{t('ai.run.covered')}</th>
                  <th>{t('ai.r.col.unmet')}</th>
                  <th>{t('ai.p.col.cost')}</th>
                  <th>{t('ai.run.status')}</th>
                </tr>
              </thead>
              <tbody>
                {result.purchases.map((p) => (
                  <tr key={p.productId}>
                    <th scope="row">{p.name}</th>
                    <td>{f.n(p.shortage)}</td>
                    <td>{f.n(p.covered)}</td>
                    <td className={p.uncovered > 0 ? 'ai-shortage' : undefined}>
                      {f.n(p.uncovered)}
                    </td>
                    <td>{f.eur(p.costEur)}</td>
                    <td>
                      <span
                        className={`ai-tag ${p.status === 'on_time' ? 'ai-tag-ok' : 'ai-tag-warn'}`}
                      >
                        {t(`ai.run.statuses.${p.status}`, {
                          defaultValue: p.status,
                        })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3>{t('ai.r.dailyPlan')}</h3>
      {rows.length === 0 ? (
        <p className="message message-success">{t('ai.p.nothingToBuy')}</p>
      ) : (
        <div className="ai-scroll">
          <table className="ai-table">
            <thead>
              <tr>
                <th>{t('ai.r.col.day')}</th>
                <th>{t('ai.r.col.item')}</th>
                <th>{t('ai.r.col.replenish')}</th>
                <th>{t('ai.r.col.supplier')}</th>
                <th>{t('ai.p.col.unitPrice')}</th>
                <th>{t('ai.p.col.cost')}</th>
                <th>{t('ai.r.col.delivery')}</th>
                <th>{t('ai.r.col.unmet')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ key, purchase, a, u }) =>
                a ? (
                  <tr key={key}>
                    <td>{a.forDate}</td>
                    <td>{purchase.name}</td>
                    <td>{f.n(a.quantity)}</td>
                    <td>{a.supplierName ?? a.supplierId}</td>
                    <td>{f.eur(a.unitPriceEur)}</td>
                    <td>{f.eur(a.costEur)}</td>
                    <td>
                      {a.arrivalDate}{' '}
                      {!a.onTime && (
                        <span className="ai-tag ai-tag-warn">
                          {t('ai.p.late')}
                        </span>
                      )}
                    </td>
                    <td>—</td>
                  </tr>
                ) : (
                  <tr key={key}>
                    <td>{u.date}</td>
                    <td>{purchase.name}</td>
                    <td>—</td>
                    <td>
                      <span className="ai-tag">
                        {t(`ai.p.codes.${u.reason}`, {
                          defaultValue: t('ai.noSupplier'),
                        })}
                      </span>
                    </td>
                    <td>—</td>
                    <td>—</td>
                    <td>—</td>
                    <td className="ai-shortage">{f.n(u.quantity)}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      <CodeList
        items={result.warnings}
        titleKey="ai.r.warnings"
        variant="warning"
      />
    </article>
  );
}
