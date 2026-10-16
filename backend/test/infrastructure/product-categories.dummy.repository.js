const normalizeForComparison = (value) =>
  String(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function createDummyProductCategoriesRepository() {
  const categories = [];
  let idCounter = 1;

  const isSameName = (a, b) => normalizeForComparison(a) === normalizeForComparison(b);

  const createDuplicateKeyError = () => {
    const error = new Error('Duplicate Key');
    error.code = 11000;
    return error;
  };

  return {
    listProductCategories: async () => categories,

    searchByName: async(name) => {
        const term = typeof name === 'string' ? name.trim() : '';
        if (!term) return [];

        return categories.filter((c) => isSameName(c.name, term));
    },

    findById: async (id) => categories.find((c) => String(c._id) === String(id)) ?? null,

    create: async (categoryData) => {
        if (categories.some((c) => isSameName(c.name, categoryData.name))) {
            throw createDuplicateKeyError();
        }

        const hexId = 'abcdef' + (idCounter++).toString(16).padStart(18, '0');
        const newCategory = {_id: hexId, ...categoryData, isActive: categoryData.isActive ?? true};

        categories.push(newCategory);
        return newCategory;
    },

    update: async (id, data) => {
        const index = categories.findIndex((c) => String(c._id) === String(id));
        if (index === -1) return null;

        const nameTaken = categories.some(
            (c, i) => i !== index && data.name !== undefined && isSameName(c.name, data.name),
        );
        if (nameTaken) throw createDuplicateKeyError();

        categories[index] = {...categories[index], ...data};
        return categories[index];
    },

    remove: async (id) => {
        const index = categories.findIndex((c) => String(c._id) === String(id));
        if (index === -1) return null;
        
        return categories.splice(index, 1)[0];
    },

    _getCategories: () => categories,
  };
}
