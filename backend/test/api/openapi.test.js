import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildOpenApiSpec, openApiSpec, openApiSpecs } from '../../src/api/openapi.js';
import {
  API_VERSIONS,
  CURRENT_API_VERSION,
  SUPPORTED_API_VERSIONS,
} from '../../src/api/api-versions.js';

const readCommitted = (version) =>
  JSON.parse(readFileSync(new URL(`../../src/api/openapi.${version}.json`, import.meta.url), 'utf8'));

const operationsOf = (spec) =>
  Object.values(spec.paths).flatMap((item) =>
    Object.entries(item)
      .filter(([key]) => ['get', 'post', 'put', 'patch', 'delete'].includes(key))
      .map(([, operation]) => operation),
  );

for (const version of SUPPORTED_API_VERSIONS) {
  test(`openapi.${version}.json is up to date with openapi.js`, () => {
    assert.deepEqual(readCommitted(version), JSON.parse(JSON.stringify(openApiSpecs[version])));
  });

  test(`the ${version} document points to /api/${version} and carries its contract version`, () => {
    const spec = openApiSpecs[version];
    assert.deepEqual(spec.servers, [{ url: `/api/${version}` }]);
    assert.equal(spec.info.version, API_VERSIONS[version].specVersion);
  });
}

test('openApiSpec is the document of the current version (v2)', () => {
  assert.equal(CURRENT_API_VERSION, 'v2');
  assert.equal(openApiSpec, openApiSpecs.v2);
});

test('every v1 operation is deprecated and no v2 operation is', () => {
  assert.ok(operationsOf(openApiSpecs.v1).every((operation) => operation.deprecated === true));
  assert.ok(operationsOf(openApiSpecs.v2).every((operation) => operation.deprecated === undefined));
});

test('v1 and v2 expose the same paths and schemas', () => {
  assert.deepEqual(Object.keys(openApiSpecs.v1.paths), Object.keys(openApiSpecs.v2.paths));
  assert.equal(openApiSpecs.v1.components, openApiSpecs.v2.components);
});

test('buildOpenApiSpec rejects an unknown version', () => {
  assert.throws(() => buildOpenApiSpec('v9'), /Unsupported API version: v9/);
});
