import { useTranslation } from 'react-i18next';
import { dash, useFormat } from '../shared/ai-format.js';
import { buildPreviewRows } from './supplier-model.js';

/**
 * Offers of a supplier scenario, one row per offer. Products without offers (in the file or
 * missing from it) appear as "no supplier configured". Every offer is simulated.
 */
export default function SupplierPreview({ scenario, exported }) {
  const { t } = useTranslation();
  const f = useFormat();
  const rows = buildPreviewRows(scenario, exported);
  const offers = rows.filter((r) => r.offer).length;
  const withoutSupplier = rows.length - offers;

  return (
    <>
      <p>
        {t('ai.sp.summary', {
          suppliers: scenario.suppliers?.length ?? 0,
          offers,
          withoutSupplier,
        })}
      </p>
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
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">
                  {row.productName ?? <code>{row.productId}</code>}
                </th>
                {row.offer ? (
                  <>
                    <td>{row.offer.supplierName}</td>
                    <td>{f.eur(row.offer.priceEur)}</td>
                    <td>{f.n(row.offer.stockUnits)}</td>
                    <td>{f.eur(row.offer.unitPriceEur)}</td>
                    <td>{f.n(row.offer.leadTimeDays)}</td>
                    <td>{dash(row.offer.supplyLimit ?? t('ai.sp.noLimit'))}</td>
                    <td>
                      <span className="ai-tag">{t('ai.sp.simulated')}</span>
                    </td>
                  </>
                ) : (
                  <td colSpan={7}>
                    <span className="ai-tag ai-tag-warn">
                      {t('ai.noSupplier')}
                    </span>
                    {row.missing && <> {t('ai.sp.notInFile')}</>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
