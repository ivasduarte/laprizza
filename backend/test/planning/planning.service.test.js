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
