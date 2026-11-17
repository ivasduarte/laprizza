import { GUEST_PERMISSIONS } from "../../domain/auth/permissions.domain.js";

/**
 * Auth controller: HTTP <-> use cases. Manages the refresh token cookie;
 * the refresh token never goes in the response body.
 *
 * @param {{authService: object, config: object}} deps
 */
export function createAuthController({ authService, config }) {
  // The cookie is scoped to the auth path of the API version that issued it
  // (e.g. /api/v2/auth), so each version refreshes its own session cookie.
  const cookieOptionsFor = (req) => ({
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    path: req.baseUrl || config.cookie.path,
  });
  const setRefreshCookie = (req, res, token, expiresAt) =>
    res.cookie(config.cookie.name, token, { ...cookieOptionsFor(req), expires: new Date(expiresAt) });
  const clearRefreshCookie = (req, res) => res.clearCookie(config.cookie.name, cookieOptionsFor(req));
  const contextOf = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

  const sessionBody = (result) => ({
    accessToken: result.accessToken,
    tokenType: 'Bearer',
    expiresIn: result.expiresIn,
    user: result.user,
  });

  return {
    async login(req, res, next) {
      try {
        const result = await authService.login(req.body, contextOf(req));
        setRefreshCookie(req, res, result.refreshToken, result.refreshTokenExpiresAt);
        res.status(200).json(sessionBody(result));
      } catch (err) {
        next(err);
      }
    },

    async refresh(req, res, next) {
      try {
        const result = await authService.refresh(req.cookies?.[config.cookie.name], contextOf(req));
        setRefreshCookie(req, res, result.refreshToken, result.refreshTokenExpiresAt);
        res.status(200).json(sessionBody(result));
      } catch (err) {
        if (err.status === 401) clearRefreshCookie(req, res);
        next(err);
      }
    },

    async logout(req, res, next) {
      try {
        if (req.user) {
           await authService.logout(req.user, contextOf(req));
        }

        clearRefreshCookie(req, res);
        res.status(204).end();
      } catch (error) {
        next(error); 
      }
    },

    async logoutAll(req, res, next) {
      try {
        await authService.logoutAll(req.user, contextOf(req));
        clearRefreshCookie(req, res);
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },

    forgotPassword(req, res) {
      authService.requestPasswordReset(req.body, contextOf(req));
      // Always the same body, whether or not the account exists.
      res.status(202).json({ code: 'PASSWORD_RESET_REQUESTED' });
    },

    async resetPassword(req, res, next) {
      try {
        await authService.resetPassword(req.body, contextOf(req));
        clearRefreshCookie(req, res);
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },

    async changePassword(req, res, next) {
      try {
        await authService.changePassword(
          { ...req.body, userId: req.user.userId, sessionId: req.user.sessionId },
          contextOf(req),
        );
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },

    async me(req, res, next) {
      try {
        res.status(200).json(await authService.getCurrentUser(req.user.userId));
      } catch (err) {
        next(err);
      }
    },

    guestPermissions(_req, res) {
      res.set('Cache-Control', 'public, max-age=300');
      res.status(200).json({ permissions: [...GUEST_PERMISSIONS] });
    },
  };
}
