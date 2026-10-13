/**
 * Factory function that creates an in-memory dummy customers repository for testing.
 * Implements the same interface as the real infrastructure repository.
 * Simulates database operations, constraints (duplicate email), and ObjectId generation.
 *
 * @returns {Object} The dummy repository instance.
 */
export function createDummyCustomersRepository() {
  const customers = [];
  let idCounter = 1;

  const duplicateKeyError = (field) => {
    const error = new Error('Duplicate key');
    error.code = 11000;
    error.keyPattern = { [field]: 1 };
    return error;
  };

  const findConflictingField = (data, ignoreId) =>
    ['email', 'phoneNumber'].find(
      (field) =>
        data[field] !== undefined &&
        customers.some((c) => String(c._id) !== String(ignoreId) && c[field] === data[field]),
    );

  return {
    /**
     * Retrieves all customers from the in-memory array.
     * @returns {Promise<Object[]>}
     */
    listCustomers: async (query = {}) => {
      const term = query.search?.trim().toLowerCase();
      if (!term) return customers;
      return customers.filter((c) =>
        [c.name, c.email, c.phoneNumber].some((field) => field?.toLowerCase().includes(term)),
      );
    },

    /**
     * Finds a customer by their simulated MongoDB hex ID.
     * @param {string} id - The 24-character hex string ID.
     * @returns {Promise<Object|undefined>}
     */
    findById: async (id) => customers.find((c) => String(c._id) === String(id)),

    /**
     * Simulates saving a new customer.
     * Enforces unique email constraint (throws 11000).
     * @param {Object} customerData - Customer payload.
     * @returns {Promise<Object>}
     */
    create: async (customerData) => {
      const conflict = findConflictingField(customerData);
      if (conflict) throw duplicateKeyError(conflict);
      const hexId = 'c0c0c0' + (idCounter++).toString(16).padStart(18, '0');
      const newCustomer = { _id: hexId, isActive: true, dietaryRestrictions: [], ...customerData };
      customers.push(newCustomer);
      return newCustomer;
    },

    /**
     * Simulates a partial update of a customer document.
     * @param {string} id - Customer ID.
     * @param {Object} data - Fields to patch.
     * @returns {Promise<Object|null>}
     */
    update: async (id, data) => {
      const index = customers.findIndex((c) => String(c._id) === String(id));
      if (index === -1) return null;
      const conflict = findConflictingField(data, id);
      if (conflict) throw duplicateKeyError(conflict);
      customers[index] = { ...customers[index], ...data };
      return customers[index];
    },

    /**
     * Internal helper to assert the raw state of the array.
     * @returns {Object[]}
     */
    _getCustomers: () => customers,
  };
}