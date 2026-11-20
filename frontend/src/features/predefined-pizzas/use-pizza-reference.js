import {
  useGetAllergens,
  useGetPizzaComponentType,
  useGetPizzaSize,
  useGetPredefinedPizzas,
  useGetProducts,
} from '../../api/generated/default/default';
import { useCan } from '../../shared/auth/use-can.js';

const byId = (list) => new Map((list ?? []).map((item) => [item.id, item]));
const byAssemblyOrder = (a, b) => a.assemblyOrder - b.assemblyOrder;

export function usePizzaReferences() {
  const canReadAllergens = useCan('allergens:read');
  const products = useGetProducts();
  const sizes = useGetPizzaSize();
  const types = useGetPizzaComponentType();
  const pizzas = useGetPredefinedPizzas();
  const allergens = useGetAllergens(undefined, {
    query: { enabled: canReadAllergens },
  });

  return {
    canReadAllergens,
    loading: products.isPending || sizes.isPending || types.isPending,
    products: products.data ?? [],
    sizes: sizes.data ?? [],
    types: [...(types.data ?? [])].sort(byAssemblyOrder),
    pizzas: pizzas.data ?? [],
    productById: byId(products.data),
    sizeById: byId(sizes.data),
    allergenById: byId(allergens.data),
  };
}

export function componentAllergenNames(componentIds, refs) {
  const ids = new Set();
  componentIds.forEach((id) =>
    (refs.productById.get(id)?.allergenIds ?? []).forEach((a) => ids.add(a))
  );
  return [...ids]
    .map((id) => refs.allergenById.get(id)?.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}
