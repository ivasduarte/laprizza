import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collectMaterialViolations,
  isValidAssetReference,
} from '../../src/domain/material/material.domain.js';

const PATH = '/elements/0/material';

test('collectMaterialViolations accepts a missing material', () => {
  assert.deepEqual(collectMaterialViolations(undefined, PATH), []);
});

test('collectMaterialViolations accepts a material without textures (plain colour)', () => {
  assert.deepEqual(
    collectMaterialViolations({ color: '#b5562c', roughness: 0.8, metalness: 0 }, PATH),
    [],
  );
});

test('collectMaterialViolations accepts a colour map with any one of the detail maps (VIS04)', () => {
  const colorMap = '/textures/red_brick/diffuse.jpg';
  for (const detailMap of ['roughnessMap', 'bumpMap', 'normalMap']) {
    const material = { colorMap, [detailMap]: `/textures/red_brick/${detailMap}.jpg` };
    assert.deepEqual(collectMaterialViolations(material, PATH), [], detailMap);
  }
});

test('collectMaterialViolations requires a detail map next to the colour map', () => {
  const violations = collectMaterialViolations({ colorMap: '/textures/x/diffuse.jpg' }, PATH);
  assert.deepEqual(violations, [
    `${PATH} must include a roughnessMap, bumpMap or normalMap with the colorMap`,
  ]);
});

test('collectMaterialViolations requires a colour map when there are texture maps', () => {
  const violations = collectMaterialViolations({ normalMap: '/textures/x/normal.jpg' }, PATH);
  assert.deepEqual(violations, [`${PATH}/colorMap is required when the material has texture maps`]);
});

test('collectMaterialViolations rejects invalid texture references with their path', () => {
  const violations = collectMaterialViolations(
    { colorMap: 'textures/x.jpg', normalMap: 'javascript:alert(1)' },
    PATH,
  );
  assert.deepEqual(violations, [
    `${PATH}/colorMap must be an absolute http(s) URL or a root-relative path`,
    `${PATH}/normalMap must be an absolute http(s) URL or a root-relative path`,
  ]);
});

test('isValidAssetReference accepts root-relative texture paths and http(s) URLs', () => {
  assert.equal(isValidAssetReference('/textures/red_brick/diffuse.jpg'), true);
  assert.equal(isValidAssetReference('https://cdn.laprizza.pt/textures/brick.jpg'), true);
  assert.equal(isValidAssetReference('//evil.example/x.jpg'), false);
});
