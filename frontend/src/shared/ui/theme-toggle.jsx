import { useTranslation } from 'react-i18next';
import { themeStore } from '../theme/theme-store.js';
import { useTheme } from '../theme/use-theme.js';
import { MoonIcon, SunIcon } from './icons.jsx';

/** Toggle button: the name stays fixed ("Dark mode") and aria-pressed carries the state. */
export default function ThemeToggle() {
  const { t } = useTranslation();
  const isDark = useTheme() === 'dark';

  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      aria-pressed={isDark}
      aria-label={t('theme.dark')}
      title={t(isDark ? 'theme.switchToLight' : 'theme.switchToDark')}
      onClick={themeStore.toggle}
    >
      <SunIcon className="theme-toggle-icon theme-toggle-sun" />
      <MoonIcon className="theme-toggle-icon theme-toggle-moon" />
    </button>
  );
}
