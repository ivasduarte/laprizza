import {
  getGetPizzaComponentTypeQueryOptions,
  getGetPizzaSizeQueryOptions,
  getGetProductsProductIdSizeConfigurationsQueryOptions,
  getGetProductsQueryOptions,
} from '../../api/generated/default/default';

export function getPredefinedPizzaErrorKey(action, error) {
  if (!error || error.global) return null;
  if (error.status === 404) return 'predefinedPizzas.errors.notFound';
  if (error.status === 409) return 'predefinedPizzas.errors.duplicateProduct';
  if (error.status === 400 && action === 'deactivate') {
    return 'predefinedPizzas.errors.notFound';
  }
  return null;
}

/** Fresh data (staleTime 0), so the diagnosis sees what the back end saw. */
const fresh = (queryClient, options) =>
  queryClient.fetchQuery({ ...options, staleTime: 0 });

export async function diagnosePizzaRefusal(queryClient, data) {
  const [products, sizes, types] = await Promise.all([
    fresh(queryClient, getGetProductsQueryOptions()),
    fresh(queryClient, getGetPizzaSizeQueryOptions()),
    fresh(queryClient, getGetPizzaComponentTypeQueryOptions()),
  ]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const sizeById = new Map(sizes.map((s) => [s.id, s]));
  const problems = [];
  const names = (list) => list.map((item) => item.name).join(', ');

  if (data.productId) {
    const product = productById.get(data.productId);
    if (
      !product ||
      product.isActive === false ||
      !product.sellable ||
      product.pizzaComponentTypeId
    ) {
      problems.push({ key: 'predefinedPizzas.errors.product' });
    }
  }

  const unavailableSizes = data.sizeIds
    .map((id) => sizeById.get(id) ?? { name: id, isActive: false })
    .filter((size) => size.isActive === false);
  if (unavailableSizes.length > 0) {
    problems.push({
      key: 'predefinedPizzas.errors.sizesInactive',
      params: { names: names(unavailableSizes) },
    });
  }

  const components = data.componentIds.map(
    (id) => productById.get(id) ?? { id, name: id, isActive: false }
  );
  const invalidComponents = components.filter(
    (c) => c.isActive === false || !c.pizzaComponentTypeId
  );
  if (invalidComponents.length > 0) {
    problems.push({
      key: 'predefinedPizzas.errors.componentsInvalid',
      params: { names: names(invalidComponents) },
    });
  }

  // Cardinality of every active component type, in assembly order.
  [...types]
    .sort((a, b) => a.assemblyOrder - b.assemblyOrder)
    .forEach((type) => {
      const count = components.filter(
        (c) => c.pizzaComponentTypeId === type.id
      ).length;
      const min = type.minQuantity ?? 0;
      const max = type.maxQuantity ?? null;
      if (count < min) {
        problems.push({
          key: 'predefinedPizzas.errors.typeMin',
          params: { type: type.name, min, count },
        });
      } else if (max !== null && count > max) {
        problems.push({
          key: 'predefinedPizzas.errors.typeMax',
          params: { type: type.name, max, count },
        });
      }
    });

  // Every chosen component needs a configuration for every chosen size.
  const validComponents = components.filter(
    (c) => !invalidComponents.includes(c)
  );
  const configured = await Promise.all(
    validComponents.map((component) =>
      fresh(
        queryClient,
        getGetProductsProductIdSizeConfigurationsQueryOptions(component.id)
      ).then(
        (configs) => new Set(configs.map((config) => config.pizzaSizeId)),
        () => new Set()
      )
    )
  );
  // Inactive sizes were already reported above.
  const activeSizeIds = data.sizeIds.filter(
    (sizeId) => sizeById.get(sizeId)?.isActive !== false && sizeById.has(sizeId)
  );
  activeSizeIds.forEach((sizeId) => {
    const missing = validComponents.filter(
      (_, index) => !configured[index].has(sizeId)
    );
    if (missing.length > 0) {
      problems.push({
        key: 'predefinedPizzas.errors.sizeWithoutConfiguration',
        params: {
          size: sizeById.get(sizeId)?.name ?? sizeId,
          names: names(missing),
        },
      });
    }
  });

  return problems.length > 0
    ? problems
    : [{ key: 'predefinedPizzas.errors.invalid' }];
}
