import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../shared/auth/auth-api.js';

/**
 * "Continue with <provider>" buttons (AA02). The list comes from the back end, so a provider
 * that is not configured never shows up. Nothing is rendered if the list is empty or unavailable:
 * local login keeps working.
 */
export default function ExternalLoginButtons({ disabled = false }) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ['auth', 'external-providers'],
    queryFn: ({ signal }) => authApi.externalProviders(signal),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const providers = Array.isArray(data) ? data : [];
  if (providers.length === 0) return null;

  return (
    <div className="external-login">
      <p className="external-login-divider">{t('auth.external.or')}</p>
      <ul className="external-login-list">
        {providers.map(({ name, label }) => (
          <li key={name}>
            <button
              type="button"
              className="ghost block"
              disabled={disabled}
              onClick={() => authApi.startExternalLogin(name)}
            >
              {t('auth.external.continueWith', { provider: label })}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
