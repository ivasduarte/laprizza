const errorResponse = (description) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

const invitationToken = {
  type: 'string',
  pattern: '^[A-Za-z0-9_-]{43}$',
  description: 'Token of the activation link (the value after "#token=" in the e-mail).',
};

/** Account activation (AA07) with the invitation issued by AA06. Public: no session exists yet. */
export const activationPaths = {
  '/auth/activation/inspect': {
    post: {
      summary: 'Check an activation link before activating (public, the link is not used)',
      description:
        'Tells the activation page which step to show. `method` is `local` (the user sets the password) or `external` (the user signs in at `provider`, the provider linked to the account). The e-mail is masked. Never cached.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['token'],
              properties: { token: invitationToken },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'The link can activate its account',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['method', 'email', 'expiresAt'],
                properties: {
                  method: { type: 'string', enum: ['local', 'external'] },
                  provider: { type: 'string', example: 'google' },
                  email: { type: 'string', example: 'm***a@laprizza.pt' },
                  expiresAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        400: errorResponse(
          'VALIDATION_FAILED (malformed token) or INVITATION_INVALID (unknown, used, replaced or expired link, or account not waiting for activation)',
        ),
        429: errorResponse('RATE_LIMITED: too many failed attempts from this address'),
      },
    },
  },
  '/auth/activation/local': {
    post: {
      summary: 'Activate a local account by setting its password (public)',
      description:
        'Uses the invitation (single use) and activates the account with the password chosen by the user. No session is opened and the roles are not changed: the user logs in afterwards with POST /auth/login. A password that breaks the policy is refused before the link is used.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['token', 'newPassword'],
              properties: {
                token: invitationToken,
                newPassword: {
                  type: 'string',
                  maxLength: 256,
                  description:
                    '8 to 64 characters, at least one uppercase letter and one of ! @ # $ % ^ & * . , - _ ?',
                },
              },
            },
          },
        },
      },
      responses: {
        204: { description: 'Account activated' },
        400: errorResponse(
          'VALIDATION_FAILED, PASSWORD_POLICY_VIOLATION or INVITATION_INVALID (also for an account that must be activated at its identity provider)',
        ),
        429: errorResponse('RATE_LIMITED: too many failed attempts from this address'),
      },
    },
  },
};
