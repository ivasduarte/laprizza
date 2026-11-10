export const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.md',
  '.txt',
  '.docx',
  '.xlsx',
  '.png',
  '.jpg',
];
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}\p{M}._ -]{0,99}$/u;
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

export function looksLikePersonalData(name) {
  if (PERSONAL_NUMBER_PATTERN.test(name)) return true;
  const comparable = comparableName(name);
  return FORBIDDEN_NAME_TERMS.some((term) => comparable.includes(term));
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getSharedResourcesErrorKey(error) {
  switch (error?.status) {
    case 0:
      return 'sharedResources.err.network';
    case 400:
      return 'sharedResources.err.invalid';
    case 401:
      return 'sharedResources.err.session';
    case 403:
      return 'sharedResources.err.forbidden';
    case 404:
      return 'sharedResources.err.notFound';
    case 413:
      return 'sharedResources.err.tooLarge';
    default:
      return 'sharedResources.err.generic';
  }
}

export function validateUpload(name, file) {
  if (!file) return 'sharedResources.err.noFile';
  if (file.size === 0) return 'sharedResources.err.empty';
  if (file.size > MAX_FILE_SIZE) return 'sharedResources.err.tooLarge';
  const normalized = name.normalize('NFC');
  if (
    !NAME_PATTERN.test(normalized) ||
    new TextEncoder().encode(normalized).length > MAX_NAME_BYTES
  ) {
    return 'sharedResources.err.name';
  }
  if (looksLikePersonalData(normalized)) {
    return 'sharedResources.err.personalData';
  }
  const dot = normalized.lastIndexOf('.');
  const extension = dot === -1 ? '' : normalized.slice(dot).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension))
    return 'sharedResources.err.type';
  return null;
}
