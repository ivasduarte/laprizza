export function createDummyAllergenRepository() {
  const allergens = [];
  let idCounter = 1;
  const referencedIds = new Set();

  const duplicateKeyError = (field) => {
    const error = new Error('Duplicate key');
    error.code = 11000;
    error.keyPattern = { [field]: 1 };
    return error;
  };

  return {
    list: async () => allergens,

    search: async (name) => {
      const term = name.trim().toLowerCase();
      return allergens.filter(a => a.name.toLowerCase().includes(term));
    },

    findById: async (id) => allergens.find((a) => String(a._id) === String(id)),

    findByName: async (name) => {
      const term = name.trim().toLowerCase();
      return allergens.find((a) => a.name.toLowerCase() === term);
    },

    create: async (data) => {
      const exists = allergens.some(
        (a) => a.name.toLowerCase() === data.name.toLowerCase()
      );
      if (exists) throw duplicateKeyError('name');

      const hexId = 'a11e12' + (idCounter++).toString(16).padStart(18, '0');
      const newAllergen = { _id: hexId, isActive: true, ...data };
      allergens.push(newAllergen);
      return newAllergen;
    },

    update: async (id, data) => {
      const index = allergens.findIndex((a) => String(a._id) === String(id));
      if (index === -1) return null;
      allergens[index] = { ...allergens[index], ...data };
      return allergens[index];
    },

    isReferenced: async (id) => referencedIds.has(String(id)),

    _setReferenced: (id) => referencedIds.add(String(id)),
    _getAllergens: () => allergens,
  };
}