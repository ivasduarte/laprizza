/**
 * AA06: activation invitation e-mail. It carries a single-use link and never a password:
 * the user sets the password (local account) or signs in with the provider (external account)
 * in the activation flow (AA07).
 */
export function buildActivationInvitationEmail({ activationUrl, expiresInHours }) {
  const text = [
    'Foi criada uma conta LaPrizza para este endereço de email.',
    `Para a ativar, abra o link seguinte nas próximas ${expiresInHours} horas. Só pode ser usado uma vez:`,
    activationUrl,
    '',
    'Se não esperava este convite, ignore este email: a conta não é ativada sem o link.',
    '',
    '---',
    '',
    'A LaPrizza account was created for this e-mail address.',
    `To activate it, open the link below within ${expiresInHours} hours. It can only be used once:`,
    activationUrl,
    '',
    'If you did not expect this invitation, ignore this e-mail: the account is not activated without the link.',
  ].join('\n');

  return { subject: 'LaPrizza - Ativação de conta / Account activation', text };
}
