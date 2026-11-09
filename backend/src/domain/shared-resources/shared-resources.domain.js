export const ALLOWED_EXTENSIONS = ['.pdf', '.md', '.txt', '.docx', '.xlsx', '.png', '.jpg'];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const FILE_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}\p{M}._ -]{0,99}$/u;
const MAX_NAME_BYTES = 255;

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
  const dot = normalized.lastIndexOf('.');
  const extension = dot === -1 ? '' : normalized.slice(dot).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    throw new Error(`File type not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }
  return normalized;
}
