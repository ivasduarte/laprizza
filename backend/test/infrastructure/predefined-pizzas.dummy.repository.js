const hexId = (prefix, n) => prefix + n.toString(16).padStart(24 - prefix.length, '0');

export const SEED_IDS = {
  pizzaProduct: hexId('b10a', 1), 
  pizzaProduct2: hexId('b10a', 2),
  dough: hexId('b10a', 3),
  doughExtra: hexId('b10a', 4),
  sauce: hexId('b10a', 5),
  cheese: hexId('b10a', 6),         
  cheeseExtra: hexId('b10a', 7),    
  topping: hexId('b10a', 8),
  toppingExtra: hexId('b10a', 9),
  inactiveTopping: hexId('b10a', 10),
  toppingNoLarge: hexId('b10a', 11),
  sizeSmall: hexId('b105', 1),
  sizeLarge: hexId('b105', 2),
  sizeInactive: hexId('b105', 3),
  typeDough: hexId('b107', 1),
  typeSauce: hexId('b107', 2),
  typeCheese: hexId('b107', 3),
  typeTopping: hexId('b107', 4),
  unknown: hexId('b1ff', 1),
};

export function createDummyPredefinedPizzaRepository() {
  const I = SEED_IDS;
  const bothSizes = [I.sizeSmall, I.sizeLarge];

  const product = (id, name, extra = {}) => ({
    id,
    name,
    isActive: true,
    sellable: false,
    componentTypeId: null,
    configuredSizeIds: [],
    ...extra,
  });

  const component = (id, name, componentTypeId, configuredSizeIds = bothSizes, extra = {}) =>
    product(id, name, { componentTypeId, configuredSizeIds, ...extra });

  const products = [
    product(I.pizzaProduct, 'Margherita', { sellable: true }),
    product(I.pizzaProduct2, 'Pepperoni', { sellable: true }),
    component(I.dough, 'Classic Dough', I.typeDough),
    component(I.doughExtra, 'Whole Wheat Dough', I.typeDough),
    component(I.sauce, 'Tomato Sauce', I.typeSauce),
    component(I.cheese, 'Mozzarella', I.typeCheese),
    component(I.cheeseExtra, 'Cheddar', I.typeCheese),
    component(I.topping, 'Mushrooms', I.typeTopping),
    component(I.toppingExtra, 'Olives', I.typeTopping),
    component(I.inactiveTopping, 'Old Topping', I.typeTopping, bothSizes, { isActive: false }),
    component(I.toppingNoLarge, 'Anchovies', I.typeTopping, [I.sizeSmall]),
  ];

  const sizes = [
    { id: I.sizeSmall, name: 'Small', isActive: true },
    { id: I.sizeLarge, name: 'Large', isActive: true },
    { id: I.sizeInactive, name: 'Family', isActive: false },
  ];

  const componentTypes = [
    { id: I.typeDough, name: 'Base Dough', assemblyOrder: 1, minQuantity: 1, maxQuantity: 1 },
    { id: I.typeSauce, name: 'Base Sauce', assemblyOrder: 2, minQuantity: 0, maxQuantity: 1 },
    { id: I.typeCheese, name: 'Cheese', assemblyOrder: 3, minQuantity: 0, maxQuantity: 1 },
    { id: I.typeTopping, name: 'Topping', assemblyOrder: 4, minQuantity: 0, maxQuantity: null },
  ];

  const pizzas = [];
  let idCounter = 1;

  const duplicateKeyError = (field) => {
    const error = new Error('Duplicate key');
    error.code = 11000;
    error.keyPattern = { [field]: 1 };
    return error;
  };

  const productIdsByName = (match) =>
    products.filter((p) => match(p.name.toLowerCase())).map((p) => String(p.id));

  return {
    list: async () => pizzas,

    search: async (name) => {
      const term = name.trim().toLowerCase();
      const ids = productIdsByName((n) => n.includes(term));
      return pizzas.filter((p) => ids.includes(String(p.productId)));
    },

    findById: async (id) => pizzas.find((p) => String(p._id) === String(id)),

    findByName: async (name) => {
      const term = name.trim().toLowerCase();
      const ids = productIdsByName((n) => n === term);
      return pizzas.find((p) => ids.includes(String(p.productId)));
    },

    create: async (data) => {
      if (pizzas.some((p) => String(p.productId) === String(data.productId))) {
        throw duplicateKeyError('productId');
      }
      const newPizza = {
        _id: hexId('b10b', idCounter++),
        isActive: true,
        ...data,
      };
      pizzas.push(newPizza);
      return newPizza;
    },

    update: async (id, data) => {
      const index = pizzas.findIndex((p) => String(p._id) === String(id));
      if (index === -1) return null;
      pizzas[index] = { ...pizzas[index], ...data };
      return pizzas[index];
    },

    findProductById: async (id) => products.find((p) => p.id === String(id)) ?? null,
    findProductsByIds: async (ids) => products.filter((p) => ids.map(String).includes(p.id)),
    findSizesByIds: async (ids) => sizes.filter((s) => ids.map(String).includes(s.id)),
    listComponentTypes: async () => componentTypes,

    _getPizzas: () => pizzas,
    _getProducts: () => products,
    _getSizes: () => sizes,
  };
}
