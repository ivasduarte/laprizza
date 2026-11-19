import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createPlanningService } from '../../src/application/planning/planning.service.js';

const params = { scenarioId: 'DEMO-PARTIAL', stockMode: 'live' };

describe('Planning service (AI05)', () => {
  it('loads the snapshot of the scenario and sends it to the AI service', async () => {
    const snapshot = { meta: { snapshotId: 's1' } };
    const loadSnapshot = mock.fn(async () => snapshot);
    const aiServiceClient = { calculate: mock.fn(async () => ({ status: 'ok' })) };
    const service = createPlanningService({ loadSnapshot, aiServiceClient });

    assert.deepEqual(await service.calculateBom(params), { status: 'ok' });
    assert.deepEqual(loadSnapshot.mock.calls[0].arguments, [params]);
    assert.deepEqual(aiServiceClient.calculate.mock.calls[0].arguments, ['bom', params, snapshot]);

    await service.calculateRequirements(params);
    assert.equal(aiServiceClient.calculate.mock.calls[1].arguments[0], 'requirements');
  });

  it('does not call the AI service when the scenario does not exist', async () => {
    const notFound = Object.assign(new Error('AI scenario not found.'), { status: 404 });
    const loadSnapshot = async () => {
      throw notFound;
    };
    const aiServiceClient = { calculate: mock.fn() };
    const service = createPlanningService({ loadSnapshot, aiServiceClient });

    await assert.rejects(service.calculateBom(params), notFound);
    assert.equal(aiServiceClient.calculate.mock.callCount(), 0);
  });

  it('only forwards scenarioId and stockMode', async () => {
    const aiServiceClient = { calculate: mock.fn(async () => ({ status: 'ok' })) };
    const service = createPlanningService({ loadSnapshot: async () => ({}), aiServiceClient });
    await service.calculateBom({ ...params, extra: 'ignored' });
    assert.deepEqual(aiServiceClient.calculate.mock.calls[0].arguments[1], params);
  });
});

describe('Planning runs (WEB07): every result is recorded with the inputs it used', () => {
  const FORECAST = { id: 'f0ca57000000000000000001', name: 'Week 47', version: 3, entries: [] };
  const SUPPLIERS = { id: '5ce4a0000000000000000001', name: 'Base', version: 2, products: [] };
  const snapshot = {
    meta: {
      snapshotId: 'abc123',
      sources: {
        catalogue: { source: 'backend', version: 'bom-v1' },
        stock: { source: 'backend-live', retrievedAt: '2026-11-18T10:00:00.000Z' },
      },
    },
    scenario: { id: 'DEMO-PARTIAL', name: 'Demo', version: 1, simulated: true, stockMode: 'live' },
    forecast: FORECAST,
    supplierScenario: SUPPLIERS,
  };
  const result = {
    status: 'ok',
    simulation: true,
    summary: { totalCostEur: 12.5, feasible: true },
  };

  function setup({ calculate = async () => result } = {}) {
    const planningRunRepository = {
      create: mock.fn(async (data) => ({ _id: 'run1', ...data })),
      list: mock.fn(async () => []),
      findById: mock.fn(async () => null),
    };
    const service = createPlanningService({
      loadSnapshot: async () => snapshot,
      aiServiceClient: { calculate: mock.fn(calculate) },
      planningRunRepository,
    });
    return { service, planningRunRepository };
  }

  it('records the forecast, supplier scenario, snapshot and BOM versions and returns runId', async () => {
    const { service, planningRunRepository } = setup();
    const answer = await service.calculateRequirements(
      { ...params, forecastId: FORECAST.id },
      { requestedBy: 'u1' },
    );

    assert.equal(answer.runId, 'run1');
    assert.equal(answer.status, 'ok');
    const record = planningRunRepository.create.mock.calls[0].arguments[0];
    assert.equal(record.kind, 'requirements');
    assert.deepEqual(record.request, {
      scenarioId: 'DEMO-PARTIAL',
      stockMode: 'live',
      forecastId: FORECAST.id,
      supplierScenarioId: null,
    });
    assert.deepEqual(record.forecast, { id: FORECAST.id, name: 'Week 47', version: 3 });
    assert.deepEqual(record.supplierScenario, { id: SUPPLIERS.id, name: 'Base', version: 2 });
    assert.equal(record.snapshotId, 'abc123');
    assert.equal(record.bomVersion, 'bom-v1');
    assert.equal(record.stockSource.source, 'backend-live');
    assert.equal(record.requestedBy, 'u1');
    assert.equal(record.result, result);
  });

  it('records nothing when the calculation fails', async () => {
    const unavailable = Object.assign(new Error('down'), { status: 503 });
    const { service, planningRunRepository } = setup({
      calculate: async () => {
        throw unavailable;
      },
    });
    await assert.rejects(service.calculateBom(params), unavailable);
    assert.equal(planningRunRepository.create.mock.callCount(), 0);
  });

  it('lists runs with their associations and summary, without the full result', async () => {
    const { service, planningRunRepository } = setup();
    planningRunRepository.list.mock.mockImplementation(async () => [
      {
        _id: 'run1',
        kind: 'requirements',
        createdAt: new Date('2026-11-18T10:00:00.000Z'),
        request: { scenarioId: 'DEMO-PARTIAL', stockMode: 'live' },
        forecast: { id: FORECAST.id, name: 'Week 47', version: 3 },
        status: 'ok',
        result: { summary: { totalCostEur: 12.5, feasible: true } },
      },
    ]);

    const [run] = await service.listRuns({ forecastId: FORECAST.id });
    assert.deepEqual(planningRunRepository.list.mock.calls[0].arguments, [
      { forecastId: FORECAST.id },
    ]);
    assert.equal(run.id, 'run1');
    assert.equal(run.createdAt, '2026-11-18T10:00:00.000Z');
    assert.equal(run.forecast.version, 3);
    assert.equal(run.feasible, true);
    assert.equal(run.result, undefined);
  });

  it('gets one run with its full result; 404 PLANNING_RUN_NOT_FOUND when missing', async () => {
    const { service, planningRunRepository } = setup();
    await assert.rejects(
      service.getRun('aaaaaaaaaaaaaaaaaaaaaaaa'),
      (err) => err.status === 404 && err.code === 'PLANNING_RUN_NOT_FOUND',
    );

    planningRunRepository.findById.mock.mockImplementation(async () => ({
      _id: 'run1',
      kind: 'bom',
      status: 'ok',
      result,
    }));
    assert.deepEqual((await service.getRun('run1')).result, result);
  });

  it('without a run repository the result is returned unchanged (no runId)', async () => {
    const service = createPlanningService({
      loadSnapshot: async () => snapshot,
      aiServiceClient: { calculate: async () => result },
    });
    assert.deepEqual(await service.calculateBom(params), result);
  });
});
