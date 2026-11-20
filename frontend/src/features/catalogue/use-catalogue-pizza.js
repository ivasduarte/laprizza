import {
  useGetPizzaSize,
  useGetPredefinedPizzas,
  useGetPredefinedPizzasId,
} from '../../api/generated/default/default';
import { useCan } from '../../shared/auth/use-can.js';

export function useCataloguePizza(productId) {
  const canReadProducts = useCan('products:read');
  const sizes = useGetPizzaSize(undefined, {
    query: { enabled: canReadProducts },
  });
  const pizzas = useGetPredefinedPizzas(undefined, {
    query: { enabled: canReadProducts },
  });
  const pizzaId = (pizzas.data ?? []).find(
    (pizza) => pizza.productId === productId
  )?.id;
  const pizza = useGetPredefinedPizzasId(pizzaId, {
    query: { enabled: canReadProducts && Boolean(pizzaId) },
  });

  // A disabled query still returns cached data, so the permission is checked here too.
  if (!canReadProducts) {
    return { canReadProducts, sizeById: new Map(), pizza: null };
  }
  return {
    canReadProducts,
    sizeById: new Map((sizes.data ?? []).map((size) => [size.id, size])),
    pizza: pizzaId ? (pizza.data ?? null) : null,
  };
}

export function groupComponentsByType(components) {
  const groups = [];
  components.forEach((component) => {
    const type = component.componentType ?? null;
    const last = groups[groups.length - 1];
    if (last && (last.type?.id ?? null) === (type?.id ?? null)) {
      last.components.push(component);
    } else {
      groups.push({ type, components: [component] });
    }
  });
  return groups;
}
