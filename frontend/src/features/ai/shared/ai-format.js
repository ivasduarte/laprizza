import { useTranslation } from 'react-i18next';

export const dash = (value) =>
  value === null || value === undefined || value === '' ? '—' : value;

/** Locale-aware number, money and date formatters (EN/PT). */
export function useFormat() {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 4 });
  const money = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 4,
  });
  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  return {
    n: (v) => (typeof v === 'number' ? number.format(v) : dash(v)),
    eur: (v) => (typeof v === 'number' ? money.format(v) : '—'),
    at: (v) => {
      const d = v ? new Date(v) : null;
      return d && !Number.isNaN(d.getTime()) ? dateTime.format(d) : '—';
    },
  };
}

/** Saves a JSON value as a file download. */
export function downloadJson(value, fileName) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export const today = () => new Date().toISOString().slice(0, 10);
