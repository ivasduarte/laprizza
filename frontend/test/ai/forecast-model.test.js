import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProductOptions,
  countDays,
  emptyForm,
  fromForecast,
  groupForecasts,
  toDay,
  toPayload,
  validateForecast,
} from '../../src/features/ai/forecasts/forecast-model.js';

const MARGHERITA = 'de01b000000000000000000b';
const DRINK = 'de01b00000000000000000dd';
const RAW = 'de01b0000000000000000003';
const M = 'de01a0000000000000000002';
const L = 'de01a0000000000000000003';

const options = buildProductOptions({
  products: [
    { id: MARGHERITA, name: 'Margherita', sellable: true, isActive: true },
    { id: DRINK, name: 'Água', sellable: true },
    { id: RAW, name: 'Mozzarella', sellable: false },
  ],
  pizzas: [{ productId: MARGHERITA, sizeIds: [M], isActive: true }],
  sizes: [{ id: M, name: 'M' }],
});

const form = (entries, over = {}) => ({
  name: 'Semana 1',
  startDate: '2026-12-01',
  endDate: '2026-12-07',
  entries,
  ...over,
});
const entry = (over = {}) => ({
  date: '2026-12-01',
  productId: MARGHERITA,
  sizeId: M,
  quantity: '10',
  ...over,
});
const types = (f) =>
  validateForecast(f, options).map((p) => `${p.field}:${p.type}`);

describe('WEB07 forecast editor: product options', () => {
  it('offers only sellable products, pizzas with their sizes', () => {
    assert.deepEqual(
      options.map((o) => [o.name, o.sizes.map((s) => s.name)]),
      [
        ['Água', []],
        ['Margherita', ['M']],
      ]
    );
  });
});

describe('WEB07 forecast editor: validation (same rules as the back end)', () => {
  it('accepts a valid forecast, including size null for products without sizes', () => {
    assert.deepEqual(
      types(form([entry(), entry({ productId: DRINK, sizeId: '' })])),
      []
    );
  });

  it('rejects unknown product, missing or incompatible size', () => {
    assert.deepEqual(
      types(
        form([
          entry({ productId: RAW }),
          entry({ sizeId: '' }),
          entry({ date: '2026-12-02', sizeId: L }),
          entry({ date: '2026-12-03', productId: DRINK, sizeId: M }),
        ])
      ),
      [
        'entries.0.productId:ai.productUnknown',
        'entries.1.sizeId:ai.sizeRequired',
        'entries.2.sizeId:ai.sizeIncompatible',
        'entries.3.sizeId:ai.sizeIncompatible',
      ]
    );
  });

  it('rejects dates outside the period, an inverted period and duplicates', () => {
    assert.deepEqual(types(form([entry({ date: '2026-12-08' })])), [
      'entries.0.date:ai.dateOutside',
    ]);
    // Like the back end, an inverted period also puts every entry outside it.
    assert.deepEqual(types(form([entry()], { endDate: '2026-11-30' })), [
      'endDate:ai.periodInvalid',
      'entries.0.date:ai.dateOutside',
    ]);
    assert.deepEqual(types(form([entry(), entry({ quantity: '3' })])), [
      'entries.1:ai.duplicate',
    ]);
    assert.deepEqual(types(form([entry({ date: '2026-02-30' })])), [
      'entries.0.date:ai.dateInvalid',
    ]);
  });

  it('accepts only whole quantities, zero or more', () => {
    assert.deepEqual(types(form([entry({ quantity: '0' })])), []);
    assert.deepEqual(types(form([entry({ quantity: '1.5' })])), [
      'entries.0.quantity:number.integer',
    ]);
    assert.deepEqual(types(form([entry({ quantity: '-1' })])), [
      'entries.0.quantity:number.min',
    ]);
    assert.deepEqual(types(form([entry({ quantity: '' })])), [
      'entries.0.quantity:any.required',
    ]);
  });

  it('requires a name and at least one entry', () => {
    assert.deepEqual(types({ ...emptyForm(), entries: [] }), [
      'name:any.required',
      'startDate:any.required',
      'endDate:any.required',
      'entries:ai.noEntries',
    ]);
  });
});

describe('WEB07 forecast editor: payload and versions', () => {
  it('sends numbers, null sizes and never a version', () => {
    const payload = toPayload(
      form([entry({ productId: DRINK, sizeId: '', quantity: '4' })], {
        name: '  Semana 1 ',
      })
    );
    assert.deepEqual(payload, {
      name: 'Semana 1',
      startDate: '2026-12-01',
      endDate: '2026-12-07',
      entries: [
        { date: '2026-12-01', productId: DRINK, sizeId: null, quantity: 4 },
      ],
    });
  });

  it('prefills a new version from an existing one', () => {
    const f = fromForecast({
      name: 'Semana 1',
      version: 2,
      startDate: '2026-12-01',
      endDate: '2026-12-07',
      entries: [
        { date: '2026-12-01', productId: DRINK, sizeId: null, quantity: 0 },
      ],
    });
    assert.deepEqual(f.entries, [
      { date: '2026-12-01', productId: DRINK, sizeId: '', quantity: '0' },
    ]);
    assert.equal('version' in f, false);
  });

  it('groups versions by name (case-insensitive), newest first', () => {
    const groups = groupForecasts([
      { id: '1', name: 'Semana 1', version: 1 },
      { id: '2', name: 'semana 1', version: 2 },
      { id: '3', name: 'Natal', version: 1 },
    ]);
    assert.deepEqual(
      groups.map((g) => [g.name, g.versions.map((v) => v.version)]),
      [
        ['Natal', [1]],
        ['semana 1', [2, 1]],
      ]
    );
    assert.equal(
      countDays([entry(), entry({ date: '2026-12-02' }), entry()]),
      2
    );
  });
});

describe('WEB07 forecast editor: dates from the API', () => {
  it('prefills a new version even when the API sends full ISO timestamps', () => {
    const f = fromForecast({
      name: 'Demo A',
      version: 1,
      startDate: '2026-12-01T00:00:00.000Z',
      endDate: '2026-12-03T00:00:00.000Z',
      entries: [
        {
          date: '2026-12-02T00:00:00.000Z',
          productId: DRINK,
          sizeId: null,
          quantity: 1,
        },
      ],
    });
    assert.equal(f.startDate, '2026-12-01');
    assert.equal(f.endDate, '2026-12-03');
    assert.equal(f.entries[0].date, '2026-12-02');
    assert.equal(toDay('2026-12-01'), '2026-12-01');
    assert.equal(toDay(undefined), '');
  });
});
