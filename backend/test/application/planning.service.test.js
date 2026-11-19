import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPlanningService } from '../../src/application/planning/planning.service.js';

const FORECAST_ID = 'dddddddddddddddddddddddd';

function setup() {
  const seen = {};
  const service = createPlanningService({
    loadSnapshot: async (params) => {
      seen.snapshotParams = params;
      return { meta: { snapshotId: 's' } };
    },
    aiServiceClient: {
      calculate: async (kind, request, snapshot) => {
        seen.call = { kind, request, snapshot };
        return { status: 'ok', simulation: true };
      },
    },
  });
  return { service, seen };
}

describe('planning service', () => {
  it('passes the chosen forecast and supplier scenario to the snapshot, not to the AI request', async () => {
    const { service, seen } = setup();
    await service.calculateRequirements({
      scenarioId: 'DEMO', stockMode: 'scenario', forecastId: FORECAST_ID, supplierScenarioId: 'eeeeeeeeeeeeeeeeeeeeeeee',
    });
    assert.equal(seen.snapshotParams.forecastId, FORECAST_ID);
    assert.equal(seen.snapshotParams.supplierScenarioId, 'eeeeeeeeeeeeeeeeeeeeeeee');
    assert.deepEqual(seen.call.request, { scenarioId: 'DEMO', stockMode: 'scenario' });
    assert.equal(seen.call.kind, 'requirements');
  });

  it('omits the ids when none was chosen (the snapshot then uses the active ones)', async () => {
    const { service, seen } = setup();
    await service.calculateBom({ scenarioId: 'DEMO', stockMode: 'live' });
    assert.deepEqual(seen.snapshotParams, { scenarioId: 'DEMO', stockMode: 'live' });
  });

  it('is read-only: its only dependencies are a snapshot reader and the AI client', () => {
    assert.throws(() => createPlanningService({ aiServiceClient: {} }), /loadSnapshot/);
    assert.throws(() => createPlanningService({ loadSnapshot: () => {} }), /aiServiceClient/);
  });
});
