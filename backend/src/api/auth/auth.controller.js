/**
 * Auth controller: HTTP <-> use cases. Manages the refresh token cookie;
 * the refresh token never goes in the response body.
 *
 * @param {{authService: object, config: object}} deps
 */
export function createAuthController({ authService, config }) {
  const cookieOptions = {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    path: config.cookie.path,
  };
  const setRefreshCookie = (res, token, expiresAt) =>
    res.cookie(config.cookie.name, token, { ...cookieOptions, expires: new Date(expiresAt) });
  const clearRefreshCookie = (res) => res.clearCookie(config.cookie.name, cookieOptions);
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
        setRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt);
        res.status(200).json(sessionBody(result));
      } catch (err) {
        next(err);
      }
    },

    async refresh(req, res, next) {
      try {
        const result = await authService.refresh(req.cookies?.[config.cookie.name], contextOf(req));
        setRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt);
        res.status(200).json(sessionBody(result));
      } catch (err) {
        if (err.status === 401) clearRefreshCookie(res);
        next(err);
      }
    },

    async logout(req, res, next) {
      try {
        await authService.logout(req.user, contextOf(req));
        clearRefreshCookie(res);
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },

    async logoutAll(req, res, next) {
      try {
        await authService.logoutAll(req.user, contextOf(req));
        clearRefreshCookie(res);
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
        clearRefreshCookie(res);
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
  };
}
