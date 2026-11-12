import { writeFileSync } from 'node:fs';

const OUT = new URL('./', import.meta.url);
const AT = '2026-11-10T09:00:00.000Z';
const clone = (x) => structuredClone(x);
const byId = (a, b) => a.id.localeCompare(b.id);

const SIZES = [
  { id: 'size-l', name: 'L' },
  { id: 'size-m', name: 'M' },
  { id: 'size-s', name: 'S' },
];
const SIZE_IDS = ['size-s', 'size-m', 'size-l'];

const product = (id, name, { sellable = false, stockControlled = false, component = false } = {}) => ({
  id, name, sellable, stockControlled, isPizzaComponent: component,
});

const CONSUMPTION = {
  'c-massa': [1, 1, 2],
  'c-molho': [1, 1, 2],
  'c-mozzarella': [1, 2, 3],
  'c-fiambre': [1, 1, 2],
  'c-cogumelos': [1, 1, 2],
  'c-base-pronta': [1, 1, 2],
};

function bomFor(pizzas) {
  const bom = [];
  const issues = [];
  for (const [pizzaId, components] of Object.entries(pizzas)) {
    SIZE_IDS.forEach((sizeId, i) => {
      for (const componentId of components) {
        if (CONSUMPTION[componentId]) {
          bom.push({ pizzaId, sizeId, componentId, quantity: CONSUMPTION[componentId][i] });
        } else {
          issues.push({ code: 'UNMEASURED_NON_STOCK_COMPONENT', pizzaId, sizeId, componentId });
        }
      }
    });
  }
  bom.sort((a, b) =>
    `${a.pizzaId}|${a.sizeId}|${a.componentId}`.localeCompare(`${b.pizzaId}|${b.sizeId}|${b.componentId}`),
  );
  return { bom, issues };
}

const DEMO_PIZZAS = {
  'p-margherita': ['c-massa', 'c-molho', 'c-mozzarella'],
  'p-prosciutto': ['c-massa', 'c-molho', 'c-mozzarella', 'c-fiambre', 'c-cogumelos'],
  'p-funghi-simples': ['c-base-pronta', 'c-mozzarella', 'c-cogumelos', 'c-oregaos'],
};
const DEMO_PRODUCTS = [
  product('c-massa', '[Demo] Massa', { stockControlled: true, component: true }),
  product('c-molho', '[Demo] Molho', { stockControlled: true, component: true }),
  product('c-mozzarella', '[Demo] Mozzarella', { stockControlled: true, component: true }),
  product('c-fiambre', '[Demo] Fiambre', { stockControlled: true, component: true }),
  product('c-cogumelos', '[Demo] Cogumelos', { stockControlled: true, component: true }),
  product('c-base-pronta', '[Demo] Base pronta', { stockControlled: true, component: true }),
  product('c-oregaos', '[Demo] Orégãos', { component: true }),
  product('i-farinha', '[Demo] Farinha'),
  product('i-agua', '[Demo] Água'),
  product('i-fermento', '[Demo] Fermento'),
  product('p-margherita', '[Demo] Margherita', { sellable: true }),
  product('p-prosciutto', '[Demo] Prosciutto e Funghi', { sellable: true }),
  product('p-funghi-simples', '[Demo] Funghi Simples', { sellable: true }),
].sort(byId);
const DEMO_AGGREGATES = [
  {
    id: 'c-massa',
    classification: 'production',
    items: [
      { componentId: 'i-farinha', quantity: 2 },
      { componentId: 'i-agua', quantity: 1 },
      { componentId: 'i-fermento', quantity: 1 },
    ],
  },
  { id: 'c-molho', classification: 'purchase', items: [] },
];

function snapshot({ code, name, stock, orderLines, pizzas, products, aggregates }) {
  const { bom, issues } = bomFor(pizzas);
  const source = { source: 'scenario', scenarioId: code, scenarioVersion: 1, retrievedAt: AT };
  return {
    meta: {
      snapshotId: `fixture-${code.toLowerCase()}`,
      retrievedAt: AT,
      source: 'backend',
      simulated: true,
      sources: {
        catalogue: { source: 'backend', retrievedAt: AT, version: 'fixture' },
        stock: source,
        orders: source,
      },
    },
    scenario: { id: code, name, version: 1, simulated: true, stockMode: 'scenario' },
    pizzas: Object.keys(pizzas).sort().map((id) => ({ id, sizeIds: SIZE_IDS })),
    aggregates,
    orders: [
      {
        id: `${code}#1`,
        simulated: true,
        items: orderLines.map(([pizzaId, sizeId, quantity]) => ({ pizzaId, sizeId, quantity })),
      },
    ],
    products,
    sizes: SIZES,
    bom,
    stock: Object.entries(stock).map(([productId, quantity]) => ({ productId, quantity })),
    issues,
  };
}

const demo = (code, name, orderLines, stock) =>
  snapshot({
    code,
    name,
    orderLines,
    stock,
    pizzas: DEMO_PIZZAS,
    products: DEMO_PRODUCTS,
    aggregates: DEMO_AGGREGATES,
  });

const files = {
  'demo-basic.json': demo('DEMO-BASIC', '[Demo] Só produtos básicos',
    [['p-funghi-simples', 'size-m', 3]],
    { 'c-base-pronta': 5, 'c-mozzarella': 6, 'c-cogumelos': 4 }),
  'demo-sufficient.json': demo('DEMO-SUFFICIENT', '[Demo] Stock suficiente',
    [['p-margherita', 'size-m', 2], ['p-prosciutto', 'size-m', 1]],
    { 'c-massa': 5, 'c-molho': 5, 'c-mozzarella': 10, 'c-fiambre': 3, 'c-cogumelos': 3 }),
  'demo-insufficient.json': demo('DEMO-INSUFFICIENT', '[Demo] Stock insuficiente',
    [['p-prosciutto', 'size-l', 2], ['p-margherita', 'size-m', 1], ['p-funghi-simples', 'size-l', 1]],
    { 'c-massa': 0, 'c-molho': 2, 'c-mozzarella': 5, 'c-fiambre': 4, 'c-cogumelos': 1, 'c-base-pronta': 1 }),
  'demo-partial.json': demo('DEMO-PARTIAL', '[Demo] Agregado parcialmente em stock',
    [['p-margherita', 'size-m', 3]],
    { 'c-massa': 1, 'c-molho': 5, 'c-mozzarella': 4 }),
};

files['reference.json'] = snapshot({
  code: 'REFERENCE',
  name: 'Exemplo de referência do cliente',
  orderLines: [['p-margherita', 'size-m', 3]],
  stock: { 'c-massa': 1, 'c-molho': 5, 'c-mozzarella': 4, 'i-farinha': 3, 'i-agua': 10, 'i-fermento': 10 },
  pizzas: { 'p-margherita': DEMO_PIZZAS['p-margherita'] },
  products: [
    product('c-massa', 'Massa', { stockControlled: true, component: true }),
    product('c-molho', 'Molho', { stockControlled: true, component: true }),
    product('c-mozzarella', 'Mozzarella', { stockControlled: true, component: true }),
    product('i-farinha', 'Farinha', { stockControlled: true }),
    product('i-agua', 'Água', { stockControlled: true }),
    product('i-fermento', 'Fermento', { stockControlled: true }),
    product('p-margherita', 'Margherita', { sellable: true }),
  ].sort(byId),
  aggregates: DEMO_AGGREGATES,
});

const base = () => clone(files['demo-partial.json']);
const agg = (s, id) => s.aggregates.find((a) => a.id === id);
const invalid = {
  'invalid-snapshot.json': (s) => {
    delete s.pizzas; // a snapshot with a scenario must have pizzas
  },
  'invalid-unknown-item.json': (s) => {
    s.bom[0].componentId = 'c-nao-existe';
    s.stock.push({ productId: 'c-desconhecido', quantity: 1 });
    s.orders[0].items[0].sizeId = 'size-xl';
  },
  'invalid-zero-quantity.json': (s) => {
    agg(s, 'c-massa').items[0].quantity = 0;
    s.bom[0].quantity = 0;
    s.orders[0].items[0].quantity = 0;
    s.stock[0].quantity = -1;
  },
  'invalid-duplicates.json': (s) => {
    s.products.push(clone(s.products[0]));
    s.bom.push(clone(s.bom[0]));
    agg(s, 'c-massa').items.push(clone(agg(s, 'c-massa').items[0]));
    s.orders[0].items.push(clone(s.orders[0].items[0]));
    s.stock.push(clone(s.stock[0]));
  },
  'invalid-incomplete-aggregate.json': (s) => {
    agg(s, 'c-massa').items = [];
  },
  'invalid-purchased-with-composition.json': (s) => {
    agg(s, 'c-molho').items = [{ componentId: 'i-farinha', quantity: 3 }];
  },
  'invalid-nested-aggregate.json': (s) => {
    agg(s, 'c-massa').items.push({ componentId: 'c-molho', quantity: 1 });
  },
  'invalid-pizza-as-component.json': (s) => {
    agg(s, 'c-massa').items.push({ componentId: 'p-margherita', quantity: 1 });
  },
  'invalid-multiple.json': (s) => {
    agg(s, 'c-massa').items.push({ componentId: 'c-molho', quantity: 1 });
    agg(s, 'c-molho').items = [{ componentId: 'i-farinha', quantity: 3 }];
    s.bom[0].quantity = 0;
    s.stock.push({ productId: 'c-desconhecido', quantity: 1 });
    s.stock.push(clone(s.stock[0]));
  },
};
for (const [name, mutate] of Object.entries(invalid)) {
  const s = base();
  mutate(s);
  s.meta.snapshotId = `fixture-${name.replace('.json', '')}`;
  files[name] = s;
}

for (const [name, data] of Object.entries(files)) {
  writeFileSync(new URL(name, OUT), `${JSON.stringify(data, null, 2)}\n`);
}
console.log(`${Object.keys(files).length} fixtures written to ai-scheduling/fixtures/`);
