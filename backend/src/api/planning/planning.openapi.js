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
            description:
              '"live": current stock of the back end; "scenario": stock of the scenario.',
          },
          forecastId: {
            type: 'string',
            pattern: '^[0-9a-fA-F]{24}$',
            description:
              'Saved forecast version to execute (GET /forecasts). Default: the most recent active one.',
          },
          supplierScenarioId: {
            type: 'string',
            pattern: '^[0-9a-fA-F]{24}$',
            description:
              'Saved supplier scenario version (GET /supplier-scenarios). Default: the most recent active one.',
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
            {
              field: 'stockMode',
              type: 'any.only',
              message: '"stockMode" must be one of [live, scenario]',
            },
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
    description: 'AI scenario, forecast or supplier scenario not found (or not active).',
    content: {
      'application/json': {
        schema: errorRef,
        examples: {
          notFound: errorExample(404, 'AI_SCENARIO_NOT_FOUND', 'AI scenario not found.'),
          forecastNotFound: errorExample(404, 'FORECAST_NOT_FOUND', 'Forecast not found.'),
          supplierScenarioNotFound: errorExample(
            404,
            'SUPPLIER_SCENARIO_NOT_FOUND',
            'Supplier scenario not found.',
          ),
        },
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
              problems: [
                { code: 'MISSING_SCENARIO_STOCK', productId: 'c-mozzarella', required: 4 },
              ],
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
  'The back end builds the snapshot (same as GET /ai-data/snapshot) and sends it to the Prolog AI service, authenticated with a service key. ' +
  'Each successful calculation is recorded as a planning run (runId in the answer) with the forecast version, supplier scenario version, snapshot and BOM version it used: see GET /planning/runs.';

const runIdProperty = {
  runId: {
    type: 'string',
    pattern: '^[0-9a-fA-F]{24}$',
    description: 'Id of the recorded planning run (GET /planning/runs/{id}).',
  },
};

const inputVersion = {
  type: 'object',
  nullable: true,
  properties: { id: { type: 'string' }, name: { type: 'string' }, version: { type: 'integer' } },
};

const planningRunBase = {
  id: { type: 'string' },
  kind: { type: 'string', enum: ['bom', 'requirements'] },
  createdAt: { type: 'string', format: 'date-time' },
  requestedBy: { type: 'string', nullable: true, description: 'User id of the MANAGER.' },
  request: {
    type: 'object',
    properties: {
      scenarioId: { type: 'string' },
      stockMode: { type: 'string', enum: ['live', 'scenario'] },
      forecastId: { type: 'string', nullable: true },
      supplierScenarioId: { type: 'string', nullable: true },
    },
  },
  snapshotId: { type: 'string', nullable: true, description: 'Stock snapshot used.' },
  scenario: { type: 'object', nullable: true, additionalProperties: true },
  forecast: { ...inputVersion, description: 'Forecast version used.' },
  supplierScenario: { ...inputVersion, description: 'Supplier scenario version used.' },
  bomVersion: {
    type: 'string',
    nullable: true,
    description: 'Version (hash) of the catalogue and pizza BOM used.',
  },
  stockSource: {
    type: 'object',
    nullable: true,
    additionalProperties: true,
    description: 'Origin of the stock: backend-live or the scenario.',
  },
  status: { type: 'string' },
};

const runIdParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
};

const objectIdQuery = (name, description) => ({
  name,
  in: 'query',
  required: false,
  schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
  description,
});

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
              schema: { type: 'object', additionalProperties: true, properties: runIdProperty },
              example: {
                runId: '6afdb2ce653532f5e331aa01',
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
                  {
                    productId: 'c-mozzarella',
                    name: 'Mozzarella',
                    kind: 'simple',
                    replenishmentNeeded: 2,
                  },
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
          content: {
            'application/json': {
              schema: { type: 'object', additionalProperties: true, properties: runIdProperty },
            },
          },
        },
        ...commonErrors,
      },
    },
  },
  '/planning/runs': {
    get: {
      summary: 'List planning runs, most recent first (MANAGER only)',
      description:
        'Results already calculated (at most 100), each with the inputs it used. The full plan is only in GET /planning/runs/{id}.',
      tags: ['AI Planning'],
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: 'kind',
          in: 'query',
          required: false,
          schema: { type: 'string', enum: ['bom', 'requirements'] },
        },
        objectIdQuery('forecastId', 'Only runs of this forecast version.'),
        objectIdQuery('supplierScenarioId', 'Only runs of this supplier scenario version.'),
      ],
      responses: {
        200: {
          description: 'Success',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    ...planningRunBase,
                    summary: { type: 'object', nullable: true, additionalProperties: true },
                    feasible: { type: 'boolean', nullable: true },
                  },
                },
              },
            },
          },
        },
        400: commonErrors[400],
        401: commonErrors[401],
        403: commonErrors[403],
      },
    },
  },
  '/planning/runs/{id}': {
    get: {
      summary: 'Get a planning run with its full result (MANAGER only)',
      tags: ['AI Planning'],
      security: [{ BearerAuth: [] }],
      parameters: [runIdParam],
      responses: {
        200: {
          description: 'Success',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  ...planningRunBase,
                  result: {
                    type: 'object',
                    additionalProperties: true,
                    description: 'Answer of the AI service, as returned by POST /planning/*.',
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Invalid ID format.',
          content: { 'application/json': { schema: errorRef } },
        },
        401: commonErrors[401],
        403: commonErrors[403],
        404: {
          description: 'Planning run not found (PLANNING_RUN_NOT_FOUND).',
          content: {
            'application/json': {
              schema: errorRef,
              examples: {
                notFound: errorExample(404, 'PLANNING_RUN_NOT_FOUND', 'Planning run not found.'),
              },
            },
          },
        },
      },
    },
  },
};
