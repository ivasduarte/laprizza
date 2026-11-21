/**
 * WEB04: locate JSON problems by line, so the configuration editor can show and highlight
 * the line of each error.
 */

/**
 * Line (1-based) of every value of a JSON document, by JSON Pointer ('' is the root,
 * '/elements/0/position/x' a nested value). Object members are located at their key.
 *
 * @param {string} text
 * @returns {Map<string, number> | null} null when the text is not valid JSON.
 */
export function jsonPointerLines(text) {
  return scanJson(text).lines;
}

/**
 * Single pass over the text: the line of every pointer, or where the text stops being JSON.
 * @returns {{lines: Map<string, number> | null, error: {line: number, column: number} | null}}
 */
function scanJson(text) {
  const lines = new Map();
  let index = 0;
  let line = 1;

  const fail = () => {
    throw new SyntaxError('invalid');
  };
  const advance = () => {
    if (text[index] === '\n') line += 1;
    index += 1;
  };
  const skipSpace = () => {
    while (index < text.length && /\s/.test(text[index])) advance();
  };
  const escapeSegment = (key) =>
    key.replaceAll('~', '~0').replaceAll('/', '~1');

  function parseString() {
    if (text[index] !== '"') fail();
    const start = index;
    advance();
    while (index < text.length && text[index] !== '"') {
      if (text[index] === '\n') fail();
      if (text[index] === '\\') advance();
      advance();
    }
    if (text[index] !== '"') fail();
    advance();
    return JSON.parse(text.slice(start, index));
  }

  function parseValue(pointer) {
    skipSpace();
    if (!lines.has(pointer)) lines.set(pointer, line);
    const char = text[index];
    if (char === '{') {
      advance();
      skipSpace();
      if (text[index] === '}') return advance();
      for (;;) {
        skipSpace();
        const keyLine = line;
        const key = parseString();
        const child = `${pointer}/${escapeSegment(key)}`;
        lines.set(child, keyLine);
        skipSpace();
        if (text[index] !== ':') fail();
        advance();
        parseValue(child);
        skipSpace();
        if (text[index] === ',') {
          advance();
          continue;
        }
        if (text[index] === '}') return advance();
        fail();
      }
    }
    if (char === '[') {
      advance();
      skipSpace();
      if (text[index] === ']') return advance();
      for (let item = 0; ; item += 1) {
        parseValue(`${pointer}/${item}`);
        skipSpace();
        if (text[index] === ',') {
          advance();
          continue;
        }
        if (text[index] === ']') return advance();
        fail();
      }
    }
    if (char === '"') return parseString();
    const literal =
      /^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(
        text.slice(index)
      );
    if (!literal) fail();
    index += literal[0].length;
    return undefined;
  }

  try {
    parseValue('');
    skipSpace();
    if (index !== text.length) fail();
    return { lines, error: null };
  } catch {
    const lineStart = text.lastIndexOf('\n', index - 1) + 1;
    return { lines: null, error: { line, column: index - lineStart + 1 } };
  }
}

/**
 * JSON Pointer at the start of a back-end violation. Accepts the pointer form
 * ('/elements/0/scale/x must be ...') and the dotted form of the schema validator
 * ('.elements[0].scale.x should be ...'); 'root ...' is the whole document.
 *
 * @param {string} violation
 * @returns {string | null}
 */
export function violationPointer(violation) {
  if (typeof violation !== 'string') return null;
  const token = violation.trim().split(/\s/, 1)[0];
  if (token === 'root') return '';
  if (token.startsWith('/')) return token;
  if (token.startsWith('.') || token.startsWith('[')) {
    return token
      .replace(/\[(\d+)\]/g, '.$1')
      .replace(/\['([^']*)'\]/g, '.$1')
      .split('.')
      .filter(Boolean)
      .map((segment) => `/${segment}`)
      .join('');
  }
  return null;
}

/**
 * Line of a pointer, or of its nearest existing parent (a missing property is reported on
 * the object that should contain it).
 *
 * @param {Map<string, number> | null} lines - from jsonPointerLines
 * @param {string | null} pointer
 * @returns {number | null}
 */
export function lineForPointer(lines, pointer) {
  if (!lines || pointer === null) return null;
  let current = pointer;
  for (;;) {
    if (lines.has(current)) return lines.get(current);
    if (current === '') return null;
    current = current.slice(0, current.lastIndexOf('/'));
  }
}

/**
 * Line and column (1-based) of a JSON.parse error. Browsers word it differently
 * ("... at line 3 column 5", "... at position 42", or no location at all in recent V8);
 * without a location in the message the text is scanned again.
 *
 * @param {string} text
 * @param {Error} error
 * @returns {{line: number, column: number} | null}
 */
export function syntaxErrorLocation(text, error) {
  const message = String(error?.message ?? '');
  const lineColumn = /line (\d+) column (\d+)/i.exec(message);
  if (lineColumn) {
    return { line: Number(lineColumn[1]), column: Number(lineColumn[2]) };
  }
  const position = /position (\d+)/i.exec(message);
  if (!position) return scanJson(text).error;
  const before = text.slice(0, Number(position[1]));
  const lastBreak = before.lastIndexOf('\n');
  return {
    line: before.split('\n').length,
    column: before.length - lastBreak,
  };
}
