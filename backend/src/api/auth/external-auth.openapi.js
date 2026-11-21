const errorResponse = (description) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

const providerParam = {
  name: 'provider',
  in: 'path',
  required: true,
  description: 'Provider enabled in this deployment (see GET /auth/external/providers).',
  schema: { type: 'string', pattern: '^[a-z]{2,20}$', example: 'google' },
};

const redirectResponse = (description, headers = {}) => ({
  description,
  headers: { Location: { schema: { type: 'string', format: 'uri' } }, ...headers },
});

/** External authentication (AA02): OpenID Connect Authorization Code + PKCE. */
export const externalAuthPaths = {
  '/auth/external/providers': {
    get: {
      summary: 'External identity providers enabled in this deployment (public)',
      responses: {
        200: {
          description: 'Providers for the login buttons. Empty when external login is disabled.',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['name', 'label'],
                  properties: {
                    name: { type: 'string', example: 'google' },
                    label: { type: 'string', example: 'Google' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  '/auth/external/{provider}/login': {
    get: {
      summary: 'Start external login: redirects the browser to the identity provider',
      description:
        'Browser navigation, not an XHR call. Generates state, nonce and a PKCE challenge and keeps the transaction in a short-lived signed httpOnly cookie (lp_oidc).',
      parameters: [providerParam],
      responses: {
        302: redirectResponse('Redirect to the identity provider authorization endpoint', {
          'Set-Cookie': { description: 'lp_oidc transaction cookie (10 min, httpOnly, SameSite=Lax)', schema: { type: 'string' } },
        }),
        404: errorResponse('PROVIDER_NOT_FOUND: unknown or disabled provider'),
      },
    },
  },
  '/auth/external/{provider}/callback': {
    get: {
      summary: 'Redirect URI of the identity provider',
      description:
        'Always answers with a redirect to the SPA (`/auth/callback`). Success: `?status=success` and the refresh cookie is set; the SPA then calls POST /auth/refresh. Failure: `?status=error&code=<code>` with no session. Codes: ACCESS_DENIED, AUTH_FAILED, EMAIL_MISSING, EMAIL_NOT_VERIFIED, ACCOUNT_LINK_REQUIRED, ACCOUNT_PENDING_ACTIVATION, ACCOUNT_INACTIVE, ACCOUNT_DISABLED, NO_ACTIVE_ROLE, ROLES_UNAVAILABLE, INVITATION_INVALID, INVITATION_MISMATCH. Activation (AA07): `?status=activated` and no session.',
      parameters: [
        providerParam,
        { name: 'code', in: 'query', required: false, schema: { type: 'string' } },
        { name: 'state', in: 'query', required: false, schema: { type: 'string' } },
        { name: 'error', in: 'query', required: false, schema: { type: 'string' } },
      ],
      responses: {
        302: redirectResponse('Redirect to the SPA with the outcome', {
          'Set-Cookie': { description: 'lp_rt refresh cookie, only on success', schema: { type: 'string' } },
        }),
      },
    },
  },
  '/auth/external/activate': {
    post: {
      summary: 'Start the activation of an external account (AA07): redirects to its provider',
      description:
        'Form POST from the activation page (browser navigation, `application/x-www-form-urlencoded`), so the token never goes in a URL. The provider is the one linked to the invited account. The transaction cookie is marked as an activation: the callback then only activates the account if the authenticated identity is the one linked to it, and never opens a session. Any failure redirects to the SPA (`/auth/callback?status=error&code=INVITATION_INVALID` or `AUTH_FAILED`).',
      requestBody: {
        required: true,
        content: {
          'application/x-www-form-urlencoded': {
            schema: {
              type: 'object',
              required: ['token'],
              properties: { token: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$' } },
            },
          },
        },
      },
      responses: {
        303: redirectResponse('Redirect to the identity provider, or to the SPA with an error code', {
          'Set-Cookie': { description: 'lp_oidc transaction cookie, only when going to the provider', schema: { type: 'string' } },
        }),
      },
    },
  },
};
