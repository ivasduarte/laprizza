const REJECTED_MICROSOFT_TENANTS = new Set(['common', 'organizations']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

const trimSlash = (v) => String(v ?? '').replace(/\/+$/, '');

/**
 * Static description of each supported provider.
 * `emailVerifiedClaim` is the id_token claim that proves the IdP verified the e-mail.
 */
const PROVIDERS = Object.freeze({
  google: {
    envPrefix: 'GOOGLE',
    label: 'Google',
    scopes: 'openid email profile',
    emailVerifiedClaim: 'email_verified',
    issuer: () => 'https://accounts.google.com',
  },
  microsoft: {
    envPrefix: 'MICROSOFT',
    label: 'Microsoft',
    scopes: 'openid email profile',
    // Optional claim that must be enabled in the Entra app registration.
    emailVerifiedClaim: 'xms_edov',
    issuer: (env) => {
      const tenant = (env.MICROSOFT_TENANT ?? '').trim();
      if (!tenant) throw new Error('Fatal: MICROSOFT_TENANT is required when Microsoft login is enabled.');
      if (REJECTED_MICROSOFT_TENANTS.has(tenant.toLowerCase())) {
        throw new Error(
          'Fatal: MICROSOFT_TENANT must be a tenant GUID or "consumers" ("common"/"organizations" issue tokens whose issuer cannot be validated).',
        );
      }
      return `https://login.microsoftonline.com/${tenant}/v2.0`;
    },
  },
});

function assertSecureRedirectBase(apiPublicUrl) {
  let url;
  try {
    url = new URL(apiPublicUrl);
  } catch {
    throw new Error('Fatal: API_PUBLIC_URL is not a valid URL.');
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Fatal: API_PUBLIC_URL must be an origin only (no path), e.g. https://host.');
  }
  if (url.protocol !== 'https:' && !LOCAL_HOSTS.has(url.hostname)) {
    throw new Error('Fatal: API_PUBLIC_URL must use https (http is only allowed for localhost).');
  }
}

/**
 * Reads the external-login configuration. A provider is enabled only when its client id AND
 * secret are set; a half-configured provider is a startup error.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{apiPrefix?: string}} [options] - Current API prefix (e.g. '/api/v2', from api-versions.js).
 *   Required when a provider is enabled: it is part of the redirect URI registered at the IdP.
 * `provider.issuer` is the base URL used for OIDC discovery; the `iss` claim actually stored
 * comes from the validated id_token.
 *
 * @returns {{enabled: boolean, apiPublicUrl: string, appCallbackUrl: string, transactionTtlMs: number,
 *            providers: Record<string, object>}}
 */
export function loadOidcConfig(env = process.env, { apiPrefix } = {}) {
  const appBaseUrl = trimSlash(env.APP_BASE_URL ?? 'http://localhost:4200');
  const apiPublicUrl = trimSlash(env.API_PUBLIC_URL);
  const ttlMinutes = Number.parseInt(env.OIDC_TRANSACTION_TTL_MINUTES ?? '10', 10);
  const transactionTtlMs = (Number.isFinite(ttlMinutes) && ttlMinutes > 0 ? ttlMinutes : 10) * 60_000;

  const providers = {};
  for (const [name, def] of Object.entries(PROVIDERS)) {
    const clientId = env[`${def.envPrefix}_CLIENT_ID`]?.trim();
    const clientSecret = env[`${def.envPrefix}_CLIENT_SECRET`]?.trim();
    if (!clientId && !clientSecret) continue;
    if (!clientId || !clientSecret) {
      throw new Error(
        `Fatal: ${def.envPrefix}_CLIENT_ID and ${def.envPrefix}_CLIENT_SECRET must be set together.`,
      );
    }
    if (!apiPublicUrl) throw new Error('Fatal: API_PUBLIC_URL is required when external login is enabled.');
    if (!apiPrefix?.startsWith('/')) throw new Error('Fatal: the API prefix is required when external login is enabled.');
    assertSecureRedirectBase(apiPublicUrl);

    providers[name] = Object.freeze({
      name,
      label: def.label,
      issuer: def.issuer(env),
      clientId,
      clientSecret,
      scopes: def.scopes,
      emailVerifiedClaim: def.emailVerifiedClaim,
      redirectUri: `${apiPublicUrl}${apiPrefix}/auth/external/${name}/callback`,
    });
  }

  return {
    enabled: Object.keys(providers).length > 0,
    apiPublicUrl,
    appCallbackUrl: `${appBaseUrl}/auth/callback`,
    transactionTtlMs,
    providers,
  };
}
