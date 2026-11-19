/**
 * OIDC client adapter (Authorization Code + PKCE) on top of `openid-client` v6.
 * The library is imported lazily so the application and its tests start without it
 * when external login is disabled.
 *
 * Port used by the application layer:
 *  - createAuthorizationRequest(provider) -> { authorizationUrl, transaction }
 *  - completeAuthorization(provider, callbackUrl, transaction) -> id_token claims
 *
 * `authorizationCodeGrant` validates state, PKCE, id_token signature, iss, aud, exp and nonce.
 *
 * @param {{}} [_options]
 */
export function createOidcClient() {
  let libraryPromise;
  const library = () => (libraryPromise ??= import('openid-client'));
  const configurations = new Map(); // provider name -> Promise<Configuration>

  async function configurationOf(provider) {
    const client = await library();
    if (!configurations.has(provider.name)) {
      const pending = client
        .discovery(new URL(provider.issuer), provider.clientId, provider.clientSecret)
        .catch((err) => {
          configurations.delete(provider.name); // retry on the next login
          throw err;
        });
      configurations.set(provider.name, pending);
    }
    return configurations.get(provider.name);
  }

  return {
    async createAuthorizationRequest(provider) {
      const client = await library();
      const config = await configurationOf(provider);
      const codeVerifier = client.randomPKCECodeVerifier();
      const state = client.randomState();
      const nonce = client.randomNonce();
      const url = client.buildAuthorizationUrl(config, {
        redirect_uri: provider.redirectUri,
        scope: provider.scopes,
        code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
        code_challenge_method: 'S256',
        state,
        nonce,
      });
      return { authorizationUrl: url.href, transaction: { state, nonce, codeVerifier } };
    },

    async completeAuthorization(provider, callbackUrl, transaction) {
      const client = await library();
      const config = await configurationOf(provider);
      const tokens = await client.authorizationCodeGrant(config, new URL(callbackUrl), {
        pkceCodeVerifier: transaction.codeVerifier,
        expectedState: transaction.state,
        expectedNonce: transaction.nonce,
      });
      const claims = tokens.claims();
      if (!claims) throw new Error('The IdP did not return an id_token.');
      return claims;
    },
  };
}
