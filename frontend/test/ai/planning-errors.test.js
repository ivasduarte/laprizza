import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyPlanningError,
  validatePlanningInput,
} from '../../src/features/ai/planning/planning-errors.js';

const apiError = (status, code = null, details = null, extra = {}) => ({
  name: 'ApiError',
  status,
  code,
  details,
  ...extra,
});

describe('AI05 planning: client validation', () => {
  it('accepts a valid request', () => {
    assert.deepEqual(validatePlanningInput({ scenarioId: 'DEMO-1', stockMode: 'live' }), {});
  });
  it('rejects missing, malformed and unknown values', () => {
    assert.deepEqual(validatePlanningInput({ scenarioId: '', stockMode: 'x' }), {
      scenarioId: { type: 'any.required' },
      stockMode: { type: 'any.only' },
    });
    assert.equal(
      validatePlanningInput({ scenarioId: 'demo 1', stockMode: 'live' }).scenarioId.type,
      'planning.scenarioIdPattern',
    );
  });
});

describe('AI05 planning: outcome of a failed calculation', () => {
  it('400 VALIDATION_ERROR -> invalid input with field errors', () => {
    const f = classifyPlanningError(
      apiError(400, 'VALIDATION_ERROR', [{ field: 'stockMode', type: 'any.only', message: 'x' }]),
    );
    assert.equal(f.state, 'invalidInput');
    assert.deepEqual(f.fieldErrors, { stockMode: { type: 'any.only' } });
  });
  it('404 AI_SCENARIO_NOT_FOUND -> invalid input on scenarioId', () => {
    const f = classifyPlanningError(apiError(404, 'AI_SCENARIO_NOT_FOUND'));
    assert.equal(f.state, 'invalidInput');
    assert.equal(f.fieldErrors.scenarioId.type, 'planning.scenarioNotFound');
  });
  it('400 SCENARIO_WITHOUT_STOCK -> invalid input on stockMode', () => {
    const f = classifyPlanningError(apiError(400, 'SCENARIO_WITHOUT_STOCK'));
    assert.equal(f.fieldErrors.stockMode.type, 'planning.scenarioWithoutStock');
  });
  it('422 AI_INVALID_DATA -> missing information with the problems', () => {
    const problems = [{ code: 'MISSING_SCENARIO_STOCK', productId: 'c-mozzarella' }];
    const f = classifyPlanningError(apiError(422, 'AI_INVALID_DATA', { problems }));
    assert.equal(f.state, 'missingInformation');
    assert.deepEqual(f.problems, problems);
  });
  for (const [label, error] of [
    ['503', apiError(503, 'SERVICE_UNAVAILABLE', { reason: 'connection_failed' }, { retryAfterSeconds: 5 })],
    ['504', apiError(504, 'GATEWAY_TIMEOUT')],
    ['network', apiError(0, 'NETWORK_ERROR')],
    ['client timeout', apiError(0, 'TIMEOUT')],
  ]) {
    it(`${label} -> unavailable`, () => {
      assert.equal(classifyPlanningError(error).state, 'unavailable');
    });
  }
  it('keeps Retry-After', () => {
    assert.equal(
      classifyPlanningError(apiError(503, null, null, { retryAfterSeconds: 5 })).retryAfterSeconds,
      5,
    );
  });
  it('403 -> forbidden, 401 -> unauthenticated', () => {
    assert.equal(classifyPlanningError(apiError(403, 'FORBIDDEN')).state, 'forbidden');
    assert.equal(classifyPlanningError(apiError(401, 'TOKEN_MISSING')).state, 'unauthenticated');
  });
});
