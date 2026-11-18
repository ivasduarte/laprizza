import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSupplierScenario } from '../../src/application/supplier-scenario/supplier-scenario.service.js';

const MOZZARELLA = 'aaaaaaaaaaaaaaaaaaaaaaa1';
const FLOUR = 'aaaaaaaaaaaaaaaaaaaaaaa2';
const UNKNOWN = 'cccccccccccccccccccccccc';

const catalogue = () => ({
  listProducts: async () => [{ _id: MOZZARELLA }, { _id: FLOUR }],
});

function fakeRepository({ latestVersion = 0 } = {}) {
  const created = [];
  return {
    created,
    getLatestVersion: async () => latestVersion,
    create: async (data) => {
      created.push(data);
      return { _id: 's1', ...data };
    },
  };
}

const offer = (supplierId, over = {}) => ({ supplierId, priceEur: 10, stockUnits: 100, leadTimeDays: 2, ...over });
const valid = (over = {}) => ({
  name: 'Demo suppliers',
  suppliers: [{ id: 'S-01', name: 'One' }, { id: 'S-02' }],
  products: [{ productId: MOZZARELLA, offers: [offer('S-01'), offer('S-02', { priceEur: 9.5, stockUnits: 50 })] }],
  ...over,
});

const problemsOf = async (data) => {
  let details;
  await assert.rejects(
    () => createSupplierScenario(data, fakeRepository(), catalogue()),
    (err) => {
      assert.equal(err.status, 400);
      details = err.details;
      return true;
    },
  );
  return details.map((d) => d.type);
};

describe('createSupplierScenario', () => {
  it('accepts two offers for one product and stores them as simulated', async () => {
    const repo = fakeRepository();
    const dto = await createSupplierScenario(valid({ simulated: false }), repo, catalogue());
    assert.equal(repo.created[0].simulated, true);
    assert.equal(dto.products[0].offers.length, 2);
    assert.equal(dto.simulated, true);
  });

  it('uses the supplier id as name when the name is missing', async () => {
    const repo = fakeRepository();
    await createSupplierScenario(valid(), repo, catalogue());
    assert.equal(repo.created[0].suppliers[1].name, 'S-02');
  });

  it('creates the next version of an existing name', async () => {
    const repo = fakeRepository({ latestVersion: 4 });
    const dto = await createSupplierScenario(valid(), repo, catalogue());
    assert.equal(dto.version, 5);
  });

  it('keeps a product without offers (no configured supplier is not an error)', async () => {
    const data = valid({ products: [{ productId: FLOUR, offers: [] }] });
    await createSupplierScenario(data, fakeRepository(), catalogue());
  });

  it('rejects unknown products, suppliers and duplicates', async () => {
    assert.deepEqual(await problemsOf(valid({ products: [{ productId: UNKNOWN, offers: [offer('S-01')] }] })), ['productUnknown']);
    assert.deepEqual(await problemsOf(valid({ products: [{ productId: FLOUR, offers: [offer('S-99')] }] })), ['offerSupplierUnknown']);
    assert.deepEqual(
      await problemsOf(valid({ suppliers: [{ id: 'S-01' }, { id: 'S-01' }], products: [{ productId: FLOUR, offers: [offer('S-01')] }] })),
      ['supplierIdDuplicate'],
    );
    assert.deepEqual(await problemsOf(valid({ products: [{ productId: FLOUR, offers: [offer('S-01'), offer('S-01')] }] })), ['offerDuplicate']);
    assert.deepEqual(
      await problemsOf(valid({ products: [{ productId: FLOUR, offers: [] }, { productId: FLOUR, offers: [] }] })),
      ['productDuplicate'],
    );
  });
});
