export function createDummyProductsRepository() {
  const products = [];
  let idCounter = 1;

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

    _getProducts: () => products,
  };
}
