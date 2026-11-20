import {
  useGetAllergens,
  useGetPizzaComponentType,
  useGetProductCategories,
  useGetProducts,
} from '../../api/generated/default/default';
import { useCan } from '../../shared/auth/use-can.js';

const byId = (list) => new Map((list ?? []).map((item) => [item.id, item]));

/**
 * Lists a product refers to by id (BCK05): active categories, active component types, active
 * allergens (only with `allergens:read`, MANAGER) and, when asked, all products (aggregate items).
 * The product API only returns ids, so names are looked up here.
 *
 * @param {{ withProducts?: boolean }} [options]
 */
export function useProductReferences({ withProducts = false } = {}) {
  const canReadAllergens = useCan('allergens:read');
  const categories = useGetProductCategories();
  const types = useGetPizzaComponentType();
  const allergens = useGetAllergens(undefined, {
    query: { enabled: canReadAllergens },
  });
  const products = useGetProducts(undefined, {
    query: { enabled: withProducts },
  });

  return {
    canReadAllergens,
    categories: categories.data ?? [],
    types: types.data ?? [],
    allergens: allergens.data ?? [],
    products: products.data ?? [],
    categoryById: byId(categories.data),
    typeById: byId(types.data),
    allergenById: byId(allergens.data),
    productById: byId(products.data),
  };
}

export const itemField = (index, name) => `aggregate.items.${index}.${name}`;

let nextKey = 0;
export const newItem = (productId = '', quantity = '1') => ({
  key: `item-${(nextKey += 1)}`,
  productId,
  quantity,
});

/** Price in euros, in the language of the interface. */
export function formatPrice(value, language) {
  if (value === null || value === undefined) return '';
  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}
