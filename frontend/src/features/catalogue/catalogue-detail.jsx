import { useTranslation } from 'react-i18next';
import { formatPrice } from '../products/use-product-references.js';
import {
  groupComponentsByType,
  useCataloguePizza,
} from './use-catalogue-pizza.js';

/** Allergens of a catalogue item, always visible to every profile. */
export function CatalogueAllergens({ allergens }) {
  const { t } = useTranslation();
  if (!allergens || allergens.length === 0) {
    return <p>{t('catalogue.noAllergens')}</p>;
  }
  return (
    <p>
      <strong>
        {t('catalogue.allergens')}:{' '}
        {allergens.map((allergen) => allergen.name).join(', ')}
      </strong>
    </p>
  );
}

export default function CatalogueDetail({ item, onClose }) {
  const { t, i18n } = useTranslation();
  const extra = useCataloguePizza(item.id);
  const sizes = item.availableSizes ?? [];
  const components = extra.pizza?.defaultConfiguration?.components ?? [];

  return (
    <section className="entity-card" aria-labelledby="catalogue-item-title">
      <h2 id="catalogue-item-title">{item.name}</h2>
      <p>{item.description}</p>

      <dl className="entity-fields">
        <dt>{t('catalogue.category')}</dt>
        <dd>{item.category?.name ?? '—'}</dd>
        <dt>{t('catalogue.price')}</dt>
        <dd>{formatPrice(item.price, i18n.language)}</dd>
      </dl>

      <div className="message message-warning">
        <h3>{t('catalogue.allergens')}</h3>
        {item.allergens?.length ? (
          <ul>
            {item.allergens.map((allergen) => (
              <li key={allergen.id}>
                <strong>{allergen.name}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('catalogue.noAllergens')}</p>
        )}
      </div>

      {extra.canReadProducts && sizes.length > 0 && (
        <>
          <h3>{t('catalogue.sizePrices')}</h3>
          <div className="entity-table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('catalogue.size')}</th>
                  <th scope="col">{t('catalogue.price')}</th>
                </tr>
              </thead>
              <tbody>
                {sizes.map((size) => (
                  <tr key={size.pizzaSizeId}>
                    <td>
                      {extra.sizeById.get(size.pizzaSizeId)?.name ??
                        t('catalogue.unknownSize')}
                    </td>
                    <td>{formatPrice(size.price, i18n.language)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {extra.pizza && (
        <>
          <h3>{t('catalogue.pizza.title')}</h3>
          <dl className="entity-fields">
            {groupComponentsByType(components).map(
              ({ type, components: items }) => (
                <div key={type?.id ?? 'none'} style={{ display: 'contents' }}>
                  <dt>
                    {type
                      ? `${type.assemblyOrder}. ${type.name}`
                      : t('catalogue.pizza.otherComponents')}
                  </dt>
                  <dd>{items.map((component) => component.name).join(', ')}</dd>
                </div>
              )
            )}
            <dt>{t('catalogue.pizza.sizes')}</dt>
            <dd>
              {(extra.pizza.sizes ?? []).map((size) => size.name).join(', ') ||
                '—'}
            </dd>
          </dl>
        </>
      )}

      <div className="entity-actions">
        <button type="button" className="secondary" onClick={onClose}>
          {t('catalogue.backToCatalogue')}
        </button>
      </div>
    </section>
  );
}
