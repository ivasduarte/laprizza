import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProductsExport,
  getProductsExport,
} from '../../src/application/ai-data/ai-data.service.js';

const NOW = new Date('2026-11-19T10:00:00.000Z');

// Lean product documents, as returned by aiDataRepository.listProducts().
const catalogue = () => [
  { _id: 'p-moz', name: 'Mozzarella', stockControlled: true, sellable: false },
  { _id: 'p-cola', name: 'Cola', stockControlled: true, sellable: true, price: 2.5 },
  { _id: 'p-water', name: 'Água', stockControlled: true, sellable: true },
  {
    _id: 'p-sauce',
    name: 'Molho',
    stockControlled: true,
    aggregate: { classification: 'PURCHASED' },
  },
  {
    _id: 'p-dough',
    name: 'Massa',
    stockControlled: true,
    aggregate: { classification: 'PRODUCED' },
  },
  { _id: 'p-pizza', name: 'Margherita', stockControlled: false, sellable: true, price: 9 },
  { _id: 'p-basil', name: 'Manjericão', stockControlled: false, sellable: false },
];

const byId = (result) => Object.fromEntries(result.products.map((p) => [p.id, p]));

describe('WEB07 products export (input of the supplier file)', () => {
  it('includes raw materials, purchased aggregates and directly sold stock-controlled products', () => {
    const rows = byId(buildProductsExport(catalogue(), NOW));
    assert.equal(rows['p-moz'].kind, 'rawMaterial');
    assert.equal(rows['p-sauce'].kind, 'purchasedAggregate');
    assert.equal(rows['p-cola'].kind, 'directSale');
    assert.equal(rows['p-water'].kind, 'directSale');
  });

  it('leaves out produced aggregates and products without stock control (pizzas)', () => {
    const rows = byId(buildProductsExport(catalogue(), NOW));
    assert.equal(rows['p-dough'], undefined);
    assert.equal(rows['p-pizza'], undefined);
    assert.equal(rows['p-basil'], undefined);
  });

  it('exports id, name and abstract stock unit; the selling price is optional', () => {
    const rows = byId(buildProductsExport(catalogue(), NOW));
    assert.deepEqual(rows['p-cola'], {
      id: 'p-cola',
      name: 'Cola',
      kind: 'directSale',
      stockUnit: 'abstract stock unit',
      sellable: true,
      sellingPriceEur: 2.5,
    });
    // No catalogue price: still exported, just without sellingPriceEur.
    assert.equal('sellingPriceEur' in rows['p-water'], false);
    assert.equal('sellingPriceEur' in rows['p-moz'], false);
    assert.equal(rows['p-moz'].sellable, false);
  });

  it('is sorted by name and stamped with the export time', () => {
    const result = buildProductsExport(catalogue(), NOW);
    assert.equal(result.exportedAt, '2026-11-19T10:00:00.000Z');
    const names = result.products.map((p) => p.name);
    assert.deepEqual(
      names,
      [...names].sort((a, b) => a.localeCompare(b)),
    );
  });

  it('getProductsExport reads the products once from the repository', async () => {
    const repo = { listProducts: mock.fn(async () => catalogue()) };
    const result = await getProductsExport(repo, () => NOW);
    assert.equal(repo.listProducts.mock.callCount(), 1);
    assert.equal(result.products.length, 4);
  });
});
