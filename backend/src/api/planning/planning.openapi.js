// OpenAPI paths of the planning endpoints (AI05). Merged into openApiSpec.paths (openapi.js).

const errorRef = { $ref: '#/components/schemas/Error' };

const errorExample = (status, code, message, details) => ({
  value: { error: { status, code, message, ...(details ? { details } : {}) } },
});

const requestBody = {
  required: true,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['scenarioId', 'stockMode'],
        properties: {
          scenarioId: {
            type: 'string',
            pattern: '^[A-Z0-9-]{1,64}$',
            description: 'Code of an active AI scenario (same id as GET /ai-data/snapshot).',
          },
          stockMode: {
            type: 'string',
            enum: ['live', 'scenario'],
            description: '"live": current stock of the back end; "scenario": stock of the scenario.',
          },
        },
      },
      examples: {
        scenario: { value: { scenarioId: 'DEMO-PARTIAL', stockMode: 'scenario' } },
        live: { value: { scenarioId: 'DEMO-PARTIAL', stockMode: 'live' } },
      },
    },
  },
};

const commonErrors = {
  400: {
    description:
      'Invalid input (VALIDATION_ERROR, MALFORMED_JSON) or scenario without its own stock (SCENARIO_WITHOUT_STOCK).',
    content: {
      'application/json': {
        schema: errorRef,
        examples: {
          validation: errorExample(400, 'VALIDATION_ERROR', 'Validation failed.', [
            { field: 'stockMode', type: 'any.only', message: '"stockMode" must be one of [live, scenario]' },
          ]),
          scenarioWithoutStock: errorExample(
            400,
            'SCENARIO_WITHOUT_STOCK',
            'The scenario has no stock of its own; use stockMode=live.',
          ),
        },
      },
    },
  },
  401: {
    description: 'Missing or invalid access token.',
    content: {
      'application/json': {
        schema: errorRef,
        examples: { missing: errorExample(401, 'TOKEN_MISSING', 'Authentication required.') },
      },
    },
  },
  403: {
    description: 'The role of the user is not allowed (only MANAGER).',
    content: {
      'application/json': {
        schema: errorRef,
        examples: { forbidden: errorExample(403, 'FORBIDDEN', 'Forbidden.') },
      },
    },
  },
  404: {
    description: 'AI scenario not found or not active.',
    content: {
      'application/json': {
        schema: errorRef,
        examples: { notFound: errorExample(404, 'AI_SCENARIO_NOT_FOUND', 'AI scenario not found.') },
      },
    },
  },
  422: {
    description:
      'Missing information: the data needed for the calculation is invalid or incomplete (no recipe, stock entry missing, no forecast, ...). details.problems lists every problem.',
    content: {
      'application/json': {
        schema: errorRef,
        examples: {
          missingStock: errorExample(
            422,
            'AI_INVALID_DATA',
            'The data needed for the calculation is invalid or incomplete.',
            {
              scenario: { id: 'DEMO-PARTIAL', name: 'Demo', version: 1, stockMode: 'scenario' },
              inputs: { snapshotId: '39f659e4dbf709b3', sources: {} },
              problems: [{ code: 'MISSING_SCENARIO_STOCK', productId: 'c-mozzarella', required: 4 }],
            },
          ),
        },
      },
    },
  },
  503: {
    description:
      'The AI service is not available (details.reason: connection_failed, not_configured, service_auth_failed, ai_service_error, invalid_ai_response). Sends Retry-After.',
    content: {
      'application/json': {
        schema: errorRef,
        examples: {
          down: errorExample(503, 'SERVICE_UNAVAILABLE', 'Service Unavailable', {
            reason: 'connection_failed',
          }),
        },
      },
    },
  },
  504: {
    description: 'The AI service did not answer in time (AI_SERVICE_TIMEOUT_SECONDS).',
    content: {
      'application/json': {
        schema: errorRef,
        examples: {
          timeout: errorExample(504, 'GATEWAY_TIMEOUT', 'Gateway Timeout', { reason: 'timeout' }),
        },
      },
    },
  },
};

const readOnlyNote =
  'Simulation only (simulation: true): the calculation never changes stock nor registers purchase orders. ' +
  'The back end builds the snapshot (same as GET /ai-data/snapshot) and sends it to the Prolog AI service, authenticated with a service key.';

export const planningPaths = {
  '/planning/bom': {
    post: {
      summary: 'Bill of Materials calculation (MANAGER only)',
      description: `Explodes the orders of the scenario through the BOM and compares the requirements with the stock. ${readOnlyNote}`,
      tags: ['AI Planning'],
      security: [{ BearerAuth: [] }],
      requestBody,
      responses: {
        200: {
          description: 'Calculation done. warnings never block the calculation.',
          content: {
            'application/json': {
              schema: { type: 'object', additionalProperties: true },
              example: {
                status: 'ok',
                simulation: true,
                feasible: false,
                calculatedAt: '2026-11-17T09:00:00.000Z',
                scenario: { id: 'DEMO-PARTIAL', name: 'Demo', version: 1, stockMode: 'scenario' },
                inputs: { snapshotId: '39f659e4dbf709b3', sources: {} },
                orders: [
                  {
                    orderId: 'DEMO-PARTIAL#1',
                    pizzaId: 'p-margherita',
                    pizzaName: 'Margherita',
                    sizeId: 's-medium',
                    sizeName: 'Medium',
                    quantity: 2,
                  },
                ],
                items: [
                  {
                    productId: 'c-mozzarella',
                    name: 'Mozzarella',
                    kind: 'simple',
                    stockControlled: true,
                    required: 4,
                    requiredDirect: 4,
                    requiredFromAggregates: 0,
                    available: 2,
                    used: 2,
                    remaining: 0,
                    shortage: 2,
                  },
                ],
                shortages: [
                  { productId: 'c-mozzarella', name: 'Mozzarella', kind: 'simple', replenishmentNeeded: 2 },
                ],
                production: [],
                warnings: [{ code: 'PIZZA_STOCK_IGNORED', pizzaId: 'p-margherita' }],
              },
            },
          },
        },
        ...commonErrors,
      },
    },
  },
  '/planning/requirements': {
    post: {
      summary: 'Requirements planning of the forecast (MANAGER only)',
      description: `Net requirements per day and purchase plan with the suppliers of the active supplier scenario. ${readOnlyNote}`,
      tags: ['AI Planning'],
      security: [{ BearerAuth: [] }],
      requestBody,
      responses: {
        200: {
          description:
            'Calculation done: required quantities, purchases per supplier (suggestions only) and warnings.',
          content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
        },
        ...commonErrors,
      },
    },
  },
};
