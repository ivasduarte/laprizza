export function createDummyPizzaSizeRepository() {
  const sizes = [];
  let idCounter = 1;

  const duplicateKeyError = () => {
    const error = new Error('Duplicate key');
    error.code = 11000;
    error.keyPattern = { name: 1 };
    return error;
  };

  const findConflictingName = (name, ignoreId) =>
    sizes.find(
      (s) => String(s._id) !== String(ignoreId) && s.name.toLowerCase() === name.toLowerCase(),
    );

  return {
    listPizzaSizes: async (query = {}) => {
      const term = query.search?.trim().toLowerCase();
      if (!term) return sizes;
      return sizes.filter((s) => s.name.toLowerCase().includes(term));
    },

    findById: async (id) => sizes.find((s) => String(s._id) === String(id)),

    create: async (sizeData) => {
      if (findConflictingName(sizeData.name)) throw duplicateKeyError();
      const hexId = 'd0d0d0' + (idCounter++).toString(16).padStart(18, '0');
      const newSize = { _id: hexId, isActive: sizeData.isActive ?? true, ...sizeData };
      sizes.push(newSize);
      return newSize;
    },

    update: async (id, data) => {
      const index = sizes.findIndex((s) => String(s._id) === String(id));
      if (index === -1) return null;
      if (data.name && findConflictingName(data.name, id)) throw duplicateKeyError();
      sizes[index] = { ...sizes[index], ...data };
      return sizes[index];
    },

    _getSizes: () => sizes,
  };
}