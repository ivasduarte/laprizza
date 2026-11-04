import { writeFileSync } from 'node:fs';
import { openApiSpec as spec } from '../src/api/openapi.js';

writeFileSync('openapi.json', JSON.stringify(spec, null, 2));
