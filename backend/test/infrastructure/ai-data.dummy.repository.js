export const SEED_IDS = {
  small: 'aaaaaaaaaaaaaaaaaaaaaa01',
  medium: 'aaaaaaaaaaaaaaaaaaaaaa02',
  margherita: 'bbbbbbbbbbbbbbbbbbbbbb01',
  dough: 'cccccccccccccccccccccc01',
  cheese: 'cccccccccccccccccccccc02',
  basil: 'cccccccccccccccccccccc03',
};

const cfg = (pizzaSizeId, stockUnitsConsumed) => ({ pizzaSizeId, stockUnitsConsumed });

export function createDummyAiDataRepository() {
  const { small, medium, margherita, dough, cheese, basil } = SEED_IDS;
  const products = [
    // customerEmail is a canary: it must never reach the snapshot.
    {
      _id: margherita,
      name: 'Margherita',
      sellable: true,
      stockControlled: false,
      customerEmail: 'leak@x.pt',
    },
    {
      _id: dough,
      name: 'Dough',
      stockControlled: true,
      pizzaComponentTypeId: 't1',
      sizeConfigurations: [cfg(small, 1), cfg(medium, 1)],
    },
    {
      _id: cheese,
      name: 'Mozzarella',
      stockControlled: true,
      pizzaComponentTypeId: 't3',
      sizeConfigurations: [cfg(small, 1), cfg(medium, 2)],
    },
    {
      _id: basil,
      name: 'Basil',
      stockControlled: false,
      pizzaComponentTypeId: 't4',
      sizeConfigurations: [],
    },
  ];
  return {
    listProducts: async () => products,
    listSizes: async () => [
      { _id: small, name: 'Small' },
      { _id: medium, name: 'Medium' },
    ],
    listPredefinedPizzas: async () => [
      {
        productId: margherita,
        sizeIds: [small, medium],
        defaultConfiguration: { componentIds: [dough, cheese, basil] },
      },
    ],
    listStock: async () => [
      { productId: dough, quantity: 40 },
      { productId: cheese, quantity: 25 },
    ],
  };
}
