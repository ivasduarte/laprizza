import jwt from 'jsonwebtoken';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

export class AccessTokenError extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

export function createTokenService({ jwtSecret, accessTokenTtlSeconds, issuer = 'laprizza-api' }) {
  return {
    accessTokenTtlSeconds,

    signAccessToken({ userId, sessionId, tokenVersion }) {
      return jwt.sign({ sid: String(sessionId), tv: tokenVersion }, jwtSecret, {
        algorithm: 'HS256',
        subject: String(userId),
        jwtid: randomUUID(),
        expiresIn: accessTokenTtlSeconds,
        issuer,
      });
    },

    verifyAccessToken(token) {
      try {
        const claims = jwt.verify(token, jwtSecret, { algorithms: ['HS256'], issuer });
        if (!claims.sub || !claims.sid || !Number.isInteger(claims.tv)) {
          throw new AccessTokenError('INVALID');
        }
        return claims;
      } catch (err) {
        if (err instanceof AccessTokenError) throw err;
        throw new AccessTokenError(err.name === 'TokenExpiredError' ? 'EXPIRED' : 'INVALID');
      }
    },

    generateOpaqueToken: () => randomBytes(32).toString('base64url'),
    hashOpaqueToken: (token) => createHash('sha256').update(String(token)).digest('hex'),
  };
}
