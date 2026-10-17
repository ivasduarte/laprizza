const normalizeForComparison = (value) =>
  String(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function createDummyPizzaComponentTypesRepository() {
    const types = [];
    let idCounter = 1;

    const isSameName = (a, b) => normalizeForComparison(a) === normalizeForComparison(b);

    const createDuplicateKeyError = (keyPattern) => {
        const error = new Error('Duplicate Key');
        error.code = 11000;
        error.keyPattern = keyPattern;
        return error;
    };

    const assertNoDuplicate = (candidate, ignoredIndex = -1) => {
        if (candidate.isActive === false) return;

        types.forEach((existing, index) => {
            if (index === ignoredIndex || existing.isActive === false) return;

            if (isSameName(existing.name, candidate.name)) {
                throw createDuplicateKeyError({ name: 1 });
            }
            if (existing.assemblyOrder === candidate.assemblyOrder) {
                throw createDuplicateKeyError({ assemblyOrder: 1 });
            }
        });
    };

    const indexOfId = (id) => types.findIndex((t) => String(t._id) === String(id));

    return {
        create: async (typeData) => {
            const newType = {
                ...typeData,
                _id: 'abcdef' + (idCounter++).toString(16).padStart(18, '0'),
                maxQuantity: typeData.maxQuantity ?? null,
                isActive: typeData.isActive ?? true,
            };

            assertNoDuplicate(newType);

            types.push(newType);
            return newType;
        },

        listPizzaComponentTypes: async () => 
            types.filter((t) => t.isActive).sort((a, b) => a.assemblyOrder - b.assemblyOrder),

        findById: async (id) => types[indexOfId(id)] ?? null,
        
        searchByName: async(name) => {
            const term = typeof name === 'string' ? name.trim() : '';
            if (!term) return [];

            return types.filter((t) => isSameName(t.name, term));
        },

        update: async (id, data) => {
            const index = types.findIndex((t) => String(t._id) === String(id));
            if (index === -1) return null;

            const updated = { ...types[index], ...data };
            assertNoDuplicate(updated, index);

            types[index] = updated;
            return updated;
        },

        _getTypes: () => types,
    };
}