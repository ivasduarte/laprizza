import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  jsonPointerLines,
  lineForPointer,
  syntaxErrorLocation,
  violationPointer,
} from '../../../src/shared/json/json-locations.js';

const DOCUMENT = JSON.stringify(
  {
    dimensions: { width: 10, length: 15, height: 3 },
    elements: [
      { id: 'oven', position: { x: 5.5, y: 0, z: 0 } },
      { id: 'a/b', scale: { x: 1 } },
    ],
  },
  null,
  2
);
// Line numbers of the pretty-printed document above:
//  1 {   2 "dimensions": {   3 "width"   4 "length"   5 "height"   6 },   7 "elements": [
//  8 {   9 "id": "oven"   10 "position": {   11 "x": 5.5 ...   15 },   16 {   17 "id": "a/b"   18 "scale"

describe('JSON locations (WEB04)', () => {
  const lines = jsonPointerLines(DOCUMENT);

  it('maps every value to its line by JSON Pointer', () => {
    assert.equal(lines.get(''), 1);
    assert.equal(lines.get('/dimensions/length'), 4);
    assert.equal(lines.get('/elements/0'), 8);
    assert.equal(lines.get('/elements/0/position/x'), 11);
    assert.equal(lines.get('/elements/1/id'), 17);
  });

  it('reads the pointer of back-end violations (pointer and dotted forms)', () => {
    assert.equal(
      violationPointer(
        '/elements/0/position/x must be between -5 and 5 (inside the kitchen)'
      ),
      '/elements/0/position/x'
    );
    assert.equal(
      violationPointer('.elements[1].scale.x should be > 0'),
      '/elements/1/scale/x'
    );
    assert.equal(violationPointer('root should have required property'), '');
    assert.equal(violationPointer('Something else'), null);
  });

  it('places a missing property on the object that should contain it', () => {
    assert.equal(lineForPointer(lines, '/elements/0/material'), 8);
    assert.equal(lineForPointer(lines, '/floor/material'), 1);
    assert.equal(lineForPointer(null, '/x'), null);
  });

  it('finds the line of a syntax error in every browser wording', () => {
    const broken = '{\n  "a": 1,\n  "b": }\n';
    let error;
    try {
      JSON.parse(broken);
    } catch (err) {
      error = err;
    }
    assert.equal(syntaxErrorLocation(broken, error).line, 3);
    assert.deepEqual(
      syntaxErrorLocation('x', new SyntaxError('bad at line 7 column 2')),
      { line: 7, column: 2 }
    );
    assert.deepEqual(
      syntaxErrorLocation(
        '{\n  "a": x',
        new SyntaxError('Unexpected token at position 9')
      ),
      { line: 2, column: 8 }
    );
    assert.equal(jsonPointerLines(broken), null);
  });
});
