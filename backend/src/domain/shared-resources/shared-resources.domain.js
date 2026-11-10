export const ALLOWED_EXTENSIONS = ['.pdf', '.md', '.txt', '.docx', '.xlsx', '.png', '.jpg'];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const TEXT_EXTENSIONS = ['.md', '.txt'];

const FILE_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}\p{M}._ -]{0,99}$/u;
const MAX_NAME_BYTES = 255;

const PERSONAL_NUMBER_PATTERN = /\d{9}/;

export const FORBIDDEN_NAME_TERMS = [
  'cliente',
  'customer',
  'dietary',
  'perfil alimentar',
  'perfis alimentares',
  'backup',
  'dump',
  'password',
  'palavra passe',
  'credencia',
  'credential',
];

const comparableName = (value) =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[\s._-]+/g, ' ');

export function containsRestrictedTerms(value) {
  if (PERSONAL_NUMBER_PATTERN.test(value)) return true;
  const comparable = comparableName(value);
  return FORBIDDEN_NAME_TERMS.some((term) => comparable.includes(term));
}

export const looksLikeRestrictedName = containsRestrictedTerms;

export function getExtension(name) {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
}

export function validateResourceName(name) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error('File name is mandatory');
  }
  const normalized = name.normalize('NFC');
  if (
    !FILE_NAME_PATTERN.test(normalized) ||
    Buffer.byteLength(normalized, 'utf8') > MAX_NAME_BYTES
  ) {
    throw new Error('Invalid file name');
  }
  if (looksLikeRestrictedName(normalized)) {
    throw new Error(
      'The file name suggests restricted information (customer records, dietary profiles, credentials or backups), which cannot be shared.',
    );
  }
  if (!ALLOWED_EXTENSIONS.includes(getExtension(normalized))) {
    throw new Error(`File type not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }
  return normalized;
}

const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];

const BINARY_SIGNATURES = {
  '.pdf': [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
  '.png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  '.jpg': [0xff, 0xd8, 0xff],
  '.docx': ZIP_SIGNATURE,
  '.xlsx': ZIP_SIGNATURE,
};

const startsWith = (buffer, signature) =>
  buffer.length >= signature.length && signature.every((byte, i) => buffer[i] === byte);

export function decodeText(buffer) {
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new Error('File content does not match its type: text files must be UTF-8.');
  }
  if (text.includes('\u0000')) {
    throw new Error('File content does not match its type: binary content in a text file.');
  }
  return text;
}

export function validateResourceContent(name, buffer) {
  const extension = getExtension(name);
  if (TEXT_EXTENSIONS.includes(extension)) {
    if (containsRestrictedTerms(decodeText(buffer))) {
      throw new Error(
        'The file content suggests restricted information (customer records, dietary profiles, credentials or backups), which cannot be shared.',
      );
    }
    return;
  }
  const signature = BINARY_SIGNATURES[extension];
  if (!signature || !startsWith(buffer, signature)) {
    throw new Error(`File content does not match its type (${extension}).`);
  }
}
