import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExample,
  buildPreviewRows,
  parseSupplierJson,
  toScenarioPayload,
  validateScenarioStructure,
} from '../../src/features/ai/suppliers/supplier-model.js';

const MOZZ = 'de01b0000000000000000003';
const SAUCE = 'de01b0000000000000000002';
const offer = (supplierId, over = {}) => ({
  supplierId,
  priceEur: 10,
  stockUnits: 50,
  leadTimeDays: 2,
  ...over,
});
const scenario = (over = {}) => ({
  name: 'Demo',
  suppliers: [{ id: 'SUP-A', name: 'A' }, { id: 'SUP-B' }],
  products: [
    {
      productId: MOZZ,
      offers: [offer('SUP-A'), offer('SUP-B', { priceEur: 9 })],
    },
  ],
  ...over,
});
const problems = (s) =>
  validateScenarioStructure(s).map((p) => `${p.field}:${p.type}`);

describe('WEB07 supplier import: parse', () => {
  it('parses an object and reports empty, non-object and syntax errors with the line', () => {
    assert.equal(parseSupplierJson('{"a":1}').ok, true);
    assert.deepEqual(parseSupplierJson('  ').error, { type: 'ai.jsonEmpty' });
    assert.deepEqual(parseSupplierJson('[1]').error, {
      type: 'ai.jsonNotObject',
    });
    const bad = parseSupplierJson('{\n  "a": 1,\n  oops\n}');
    assert.equal(bad.ok, false);
    assert.match(bad.error.type, /^ai\.jsonSyntax/);
  });

  it('uses the name typed on the page and drops ignored fields', () => {
    const payload = toScenarioPayload(
      { ...scenario(), version: 9, simulated: false },
      ' Novo '
    );
    assert.deepEqual(Object.keys(payload), ['name', 'suppliers', 'products']);
    assert.equal(payload.name, 'Novo');
    assert.equal(toScenarioPayload(scenario(), '').name, 'Demo');
  });
});

describe('WEB07 supplier import: structure (same paths as the back end)', () => {
  it('accepts two offers for one product and a product without offers', () => {
    assert.deepEqual(
      problems(
        scenario({
          products: [...scenario().products, { productId: SAUCE, offers: [] }],
        })
      ),
      []
    );
  });

  it('rejects missing price and lead time', () => {
    assert.deepEqual(
      problems(
        scenario({
          products: [
            {
              productId: MOZZ,
              offers: [{ supplierId: 'SUP-A', stockUnits: 1 }],
            },
          ],
        })
      ),
      [
        'products.0.offers.0.priceEur:any.required',
        'products.0.offers.0.leadTimeDays:any.required',
      ]
    );
  });

  it('rejects unknown and duplicate references', () => {
    assert.deepEqual(
      problems(
        scenario({
          suppliers: [{ id: 'SUP-A' }, { id: 'SUP-A' }],
          products: [
            {
              productId: MOZZ,
              offers: [offer('SUP-X'), offer('SUP-A'), offer('SUP-A')],
            },
            { productId: MOZZ, offers: [] },
            { productId: 'not-an-id', offers: [] },
          ],
        })
      ),
      [
        'suppliers.1.id:ai.supplierIdDuplicate',
        'products.0.offers.0.supplierId:ai.offerSupplierUnknown',
        'products.0.offers.2.supplierId:ai.offerDuplicate',
        'products.1.productId:ai.productDuplicate',
        'products.2.productId:string.hex',
      ]
    );
  });

  it('checks number types and limits', () => {
    assert.deepEqual(
      problems(
        scenario({
          products: [
            {
              productId: MOZZ,
              offers: [
                offer('SUP-A', {
                  priceEur: '10',
                  stockUnits: 0,
                  leadTimeDays: -1,
                  supplyLimit: 1.5,
                }),
              ],
            },
          ],
        })
      ),
      [
        'products.0.offers.0.priceEur:number.base',
        'products.0.offers.0.stockUnits:number.min',
        'products.0.offers.0.leadTimeDays:number.min',
        'products.0.offers.0.supplyLimit:number.integer',
      ]
    );
  });
});

describe('WEB07 supplier import: preview', () => {
  it('lists every offer, products without offers and exported products missing from the file', () => {
    const exported = [
      { id: MOZZ, name: 'Mozzarella', kind: 'rawMaterial' },
      { id: SAUCE, name: 'Molho', kind: 'rawMaterial' },
    ];
    const rows = buildPreviewRows(scenario(), exported);
    assert.deepEqual(
      rows.map((r) => [
        r.productName,
        r.offer?.supplierName ?? null,
        r.offer?.unitPriceEur ?? null,
        Boolean(r.missing),
      ]),
      [
        ['Mozzarella', 'A', 0.2, false],
        ['Mozzarella', 'SUP-B', 0.18, false],
        ['Molho', null, null, true],
      ]
    );
  });

  it('builds an example that passes the local checks with real ids', () => {
    const example = buildExample([
      { id: MOZZ, name: 'Mozzarella' },
      { id: SAUCE, name: 'Molho' },
    ]);
    assert.deepEqual(problems(example), []);
    assert.equal(example.products[0].offers.length, 2);
  });
});
