export function createDummyProductsRepository() {
  const products = [];
  let idCounter = 1;

  const indexOfId = (id) => products.findIndex((p) => String(p._id) === String(id));
  const isForSize = (pizzaSizeId) => (configuration) =>
    String(configuration.pizzaSizeId) === String(pizzaSizeId);

  return {
    listProducts: async (query = {}) => {
      let result = [...products];

      const term = query.search?.trim().toLowerCase();
      if (term) {
        result = result.filter(
          (p) => p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term),
        );
      }

      if (query.categoryId) {
        result = result.filter((p) => String(p.categoryId) === String(query.categoryId));
      }

      if (query.isActive !== undefined) {
        result = result.filter((p) => p.isActive === query.isActive);
      }

      if (query.sellable !== undefined) {
        result = result.filter((p) => p.sellable === query.sellable);
      }

      return result;
    },

    findById: async (id) => {
      return products.find((p) => String(p._id) === String(id)) ?? null;
    },

    findByName: async (name) => {
      return products.find((p) => p.name.toLowerCase() === name.toLowerCase()) ?? null;
    },

    create: async (productData) => {
      const hexId = 'e0e0e0' + (idCounter++).toString(16).padStart(18, '0');
      const newProduct = {
        _id: hexId,
        isActive: true,
        pizzaComponentTypeId: null,
        allergenIds: [],
        sizeConfigurations: [],
        ...productData,
      };
      products.push(newProduct);
      return newProduct;
    },

    update: async (id, data) => {
      const index = products.findIndex((p) => String(p._id) === String(id));
      if (index === -1) return null;

      products[index] = { ...products[index], ...data };
      return products[index];
    },

    existsWithSizeConfigurationForPizzaSize: async (pizzaSizeId) => {
      return products.some((p) =>
        (p.sizeConfigurations ?? []).some((c) => String(c.pizzaSizeId) === String(pizzaSizeId)),
      );
    },

    existsByCategory: async (categoryId) => {
      return products.some(
        (p) => String(p.categoryId) === String(categoryId) && p.isActive !== false,
      );
    },

    // Like the real repository, it only adds when the product has no configuration for the pizza
    // size yet (otherwise, as well as for unknown products, it returns null).
    addSizeConfiguration: async (productId, configuration) => {
      const index = indexOfId(productId);
      if (index === -1) return null;

      const current = products[index].sizeConfigurations ?? [];
      if (current.some(isForSize(configuration.pizzaSizeId))) return null;

      products[index] = {
        ...products[index],
        sizeConfigurations: [...current, { ...configuration }],
      };
      return products[index];
    },

    // Returns null if the product does not exist or has no configuration for the pizza size.
    updateSizeConfiguration: async (productId, pizzaSizeId, { price, stockUnitsConsumed }) => {
      const index = indexOfId(productId);
      if (index === -1) return null;

      const current = products[index].sizeConfigurations ?? [];
      if (!current.some(isForSize(pizzaSizeId))) return null;

      products[index] = {
        ...products[index],
        sizeConfigurations: current.map((c) =>
          isForSize(pizzaSizeId)(c) ? { ...c, price, stockUnitsConsumed } : c,
        ),
      };
      return products[index];
    },

    // Returns null if the product does not exist or has no configuration for the pizza size.
    removeSizeConfiguration: async (productId, pizzaSizeId) => {
      const index = indexOfId(productId);
      if (index === -1) return null;

      const current = products[index].sizeConfigurations ?? [];
      if (!current.some(isForSize(pizzaSizeId))) return null;

      products[index] = {
        ...products[index],
        sizeConfigurations: current.filter((c) => !isForSize(pizzaSizeId)(c)),
      };
      return products[index];
    },

    _getProducts: () => products,
  };
}
