import { ExternalLoginOutcome } from '../../application/auth/external-auth.service.js';

export const TRANSACTION_COOKIE = 'lp_oidc';

/** Codes that may be shown to the SPA. Anything else becomes AUTH_FAILED. */
const PUBLIC_ERROR_CODES = new Set([
  'ACCESS_DENIED',
  'AUTH_FAILED',
  'EMAIL_MISSING',
  'EMAIL_NOT_VERIFIED',
  'ACCOUNT_LINK_REQUIRED',
  'ACCOUNT_PENDING_ACTIVATION',
  'ACCOUNT_INACTIVE',
  'ACCOUNT_DISABLED',
  'NO_ACTIVE_ROLE',
  'ROLES_UNAVAILABLE',
]);

/**
 * HTTP <-> external-authentication use cases.
 * The access token is never placed in a URL: on success the refresh cookie is set and the SPA
 * obtains the access token through POST /auth/refresh.
 *
 * @param {{externalAuthService: object, transactionCodec: object, config: object}} deps
 */
export function createExternalAuthController({ externalAuthService, transactionCodec, config }) {
  const { cookie } = config;
  const external = config.external;
  const { apiPublicUrl } = external;

  // Lax is required: the callback is a cross-site top-level navigation coming from the IdP.
  const transactionCookie = {
    httpOnly: true,
    secure: cookie.secure,
    sameSite: 'lax',
    path: `${cookie.path}/external`,
  };
  const refreshCookie = {
    httpOnly: true,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    path: cookie.path,
  };
  const contextOf = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

  function spaUrl(params) {
    const url = new URL(external.appCallbackUrl);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url.href;
  }
  const spaError = (code) =>
    spaUrl({ status: 'error', code: PUBLIC_ERROR_CODES.has(code) ? code : 'AUTH_FAILED' });

  return {
    providers(_req, res) {
      res.status(200).json(externalAuthService.listProviders());
    },

    async login(req, res, next) {
      try {
        const { authorizationUrl, transaction } = await externalAuthService.startLogin(
          req.params.provider,
        );
        res.cookie(TRANSACTION_COOKIE, transactionCodec.sign(transaction), {
          ...transactionCookie,
          maxAge: external.transactionTtlMs,
        });
        res.redirect(302, authorizationUrl);
      } catch (err) {
        next(err);
      }
    },

    async callback(req, res) {
      const providerName = req.params.provider;
      const transaction = transactionCodec.verify(req.cookies?.[TRANSACTION_COOKIE]);
      res.clearCookie(TRANSACTION_COOKIE, transactionCookie); // single use

      // The user cancelled or the IdP reported an error: no session, generic feedback.
      if (req.query?.error) {
        return res.redirect(302, spaError(req.query.error === 'access_denied' ? 'ACCESS_DENIED' : 'AUTH_FAILED'));
      }
      if (!transaction || transaction.provider !== providerName) {
        return res.redirect(302, spaError('AUTH_FAILED'));
      }

      try {
        // Built from configuration, never from the Host header.
        const callbackUrl = `${apiPublicUrl}${req.originalUrl}`;
        const result = await externalAuthService.completeLogin(
          { providerName, callbackUrl, transaction },
          contextOf(req),
        );
        if (result.outcome === ExternalLoginOutcome.SESSION) {
          res.cookie(config.cookie.name, result.session.refreshToken, {
            ...refreshCookie,
            expires: new Date(result.session.refreshTokenExpiresAt),
          });
          return res.redirect(302, spaUrl({ status: 'success' }));
        }
        return res.redirect(302, spaError('ACCOUNT_PENDING_ACTIVATION'));
      } catch (err) {
        return res.redirect(302, spaError(err?.code));
      }
    },
  };
}
