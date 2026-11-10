import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_EXTENSIONS,
  containsRestrictedTerms,
  decodeText,
  getExtension,
  looksLikeRestrictedName,
  validateResourceContent,
  validateResourceName,
} from '../../src/domain/shared-resources/shared-resources.domain.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
const PDF = Buffer.from('%PDF-1.7\n');

test('validateResourceName accepts valid names and returns them normalized (NFC)', () => {
  assert.equal(validateResourceName('manual.pdf'), 'manual.pdf');
  assert.equal(validateResourceName('MANUAL.PDF'), 'MANUAL.PDF');
  assert.equal(validateResourceName('Relatório de Operações.docx'), 'Relatório de Operações.docx');
  assert.equal(validateResourceName('relatório.pdf'), 'relatório.pdf');
  assert.equal(validateResourceName('turnos_2026-11-09.xlsx'), 'turnos_2026-11-09.xlsx');
});

test('validateResourceName rejects missing or malformed names', () => {
  for (const name of [undefined, null, 123, '', '   ']) {
    assert.throws(() => validateResourceName(name), /mandatory/, String(name));
  }
  for (const name of ['../a.txt', 'a/b.txt', 'a\\b.txt', '.hidden.txt', '-a.txt', 'a@b.txt']) {
    assert.throws(() => validateResourceName(name), /Invalid file name/, name);
  }
  assert.throws(() => validateResourceName(`${'a'.repeat(101)}.txt`), /Invalid file name/);
  assert.throws(() => validateResourceName(`${'界'.repeat(90)}.txt`), /Invalid file name/);
});

test('validateResourceName rejects extensions that are not allowed', () => {
  for (const name of ['script.exe', 'noextension', 'dados.bson', 'pagina.html']) {
    assert.throws(() => validateResourceName(name), /File type not allowed/, name);
  }
});

test('validateResourceName rejects names that suggest restricted information', () => {
  for (const name of [
    'Clientes.xlsx',
    'customer-list.xlsx',
    'Dietary Profiles.pdf',
    'perfis_alimentares.docx',
    'Backup_BD.docx',
    'dump.txt',
    'passwords.md',
    'Palavra-Passe.md',
    'credenciais.txt',
    'lista 912345678.xlsx',
  ]) {
    assert.throws(() => validateResourceName(name), /restricted information/, name);
  }
});

test('looksLikeRestrictedName ignores case, accents and separators', () => {
  assert.equal(looksLikeRestrictedName('CLIENTES.xlsx'), true);
  assert.equal(looksLikeRestrictedName('Credênciais.txt'), true);
  assert.equal(looksLikeRestrictedName('perfil.alimentar.pdf'), true);
  assert.equal(looksLikeRestrictedName('palavra_passe.txt'), true);
});

test('looksLikeRestrictedName keeps public restaurant information allowed', () => {
  assert.equal(looksLikeRestrictedName('alergénios do menu.pdf'), false);
  assert.equal(looksLikeRestrictedName('relatorio_2026-11-09.pdf'), false);
  assert.equal(looksLikeRestrictedName('fatura 20261109.pdf'), false); // 8 dígitos (data)
  assert.equal(looksLikeRestrictedName('manual de operações.pdf'), false);
});

test('getExtension returns the lower-case extension including the dot', () => {
  assert.equal(getExtension('MANUAL.PDF'), '.pdf');
  assert.equal(getExtension('a.b.c.txt'), '.txt');
  assert.equal(getExtension('noextension'), '');
});

test('validateResourceContent accepts content that matches the extension', () => {
  assert.doesNotThrow(() => validateResourceContent('a.pdf', PDF));
  assert.doesNotThrow(() => validateResourceContent('a.png', PNG));
  assert.doesNotThrow(() => validateResourceContent('a.jpg', JPG));
  assert.doesNotThrow(() => validateResourceContent('a.docx', ZIP));
  assert.doesNotThrow(() => validateResourceContent('a.xlsx', ZIP));
  assert.doesNotThrow(() => validateResourceContent('A.PDF', PDF));
  assert.doesNotThrow(() => validateResourceContent('a.txt', Buffer.from('Olá, turno da noite')));
  assert.doesNotThrow(() => validateResourceContent('a.md', Buffer.from('# Título\n- item')));
});

test('validateResourceContent rejects binaries renamed to another type', () => {
  const cases = [
    ['a.pdf', Buffer.from('not a pdf')],
    ['a.pdf', PNG],
    ['a.png', PDF],
    ['a.jpg', ZIP],
    ['a.docx', PDF],
    ['a.xlsx', Buffer.from('{"_id": {"$oid": "..."}}')], // dump JSON/BSON renomeado
    ['a.pdf', Buffer.from('%PD')], // mais curto do que a assinatura
  ];
  for (const [name, content] of cases) {
    assert.throws(() => validateResourceContent(name, content), /does not match its type/, name);
  }
});

test('validateResourceContent rejects text files that are not plain UTF-8 text', () => {
  assert.throws(
    () => validateResourceContent('a.txt', Buffer.from([0xff, 0xfe, 0x41])),
    /UTF-8/,
  );
  assert.throws(
    () => validateResourceContent('a.md', Buffer.from([0x68, 0x00, 0x69])),
    /binary content/,
  );
  assert.throws(() => validateResourceContent('a.txt', ZIP), /does not match its type/);
});

test('validateResourceContent covers every allowed extension', () => {
  const sample = { '.pdf': PDF, '.png': PNG, '.jpg': JPG, '.docx': ZIP, '.xlsx': ZIP };
  for (const extension of ALLOWED_EXTENSIONS) {
    const content = sample[extension] ?? Buffer.from('texto');
    assert.doesNotThrow(() => validateResourceContent(`a${extension}`, content), extension);
  }
});

test('decodeText returns the text of a UTF-8 buffer', () => {
  assert.equal(decodeText(Buffer.from('Olá ✓')), 'Olá ✓');
});

test('validateResourceContent rejects text files whose content has restricted terms', () => {
  const cases = [
    ['notas.txt', 'Lista de clientes da semana'],
    ['notas.md', '# Perfis alimentares\n- Mesa 4: sem glúten'],
    ['notas.txt', 'Password do router: 1234'],
    ['notas.md', 'Credenciais do POS'],
    ['notas.txt', 'Ligar para 912345678 antes das 18h'],
    ['notas.txt', 'Copia do BACKUP de ontem'],
  ];
  for (const [name, text] of cases) {
    assert.throws(
      () => validateResourceContent(name, Buffer.from(text)),
      /content suggests restricted information/,
      text,
    );
  }
});

test('validateResourceContent accepts text files without restricted terms', () => {
  for (const text of [
    '# Turnos\nAbertura às 11h, fecho às 23h.',
    'Tabela de alergénios do menu: glúten, lactose.',
    'Inventário de 2026-11-09: 20 caixas de tomate.',
  ]) {
    assert.doesNotThrow(() => validateResourceContent('notas.md', Buffer.from(text)), text);
  }
});

test('containsRestrictedTerms is the same rule used for file names', () => {
  assert.equal(looksLikeRestrictedName, containsRestrictedTerms);
  assert.equal(containsRestrictedTerms('Os Clientes da manhã'), true);
  assert.equal(containsRestrictedTerms('perfil\nalimentar'), true);
});
