import { writeFileSync } from 'node:fs';
import { openApiSpecs } from '../src/api/openapi.js';

// One committed document per API version: src/api/openapi.<version>.json
for (const [version, spec] of Object.entries(openApiSpecs)) {
  const target = new URL(`../src/api/openapi.${version}.json`, import.meta.url);
  writeFileSync(target, `${JSON.stringify(spec, null, 2)}\n`);
  console.log(`Wrote ${target.pathname}`);
}
