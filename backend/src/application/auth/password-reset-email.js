export function buildPasswordResetEmail({ resetUrl, expiresInMinutes }) {
  const text = [
    'Recebemos um pedido para redefinir a password da sua conta LaPrizza.',
    `Use o link seguinte nos próximos ${expiresInMinutes} minutos. Só pode ser usado uma vez:`,
    resetUrl,
    '',
    'Se não fez este pedido, ignore este email: a sua password atual continua válida.',
    '',
    '---',
    '',
    'We received a request to reset your LaPrizza password.',
    `Use the link below within ${expiresInMinutes} minutes. It can only be used once:`,
    resetUrl,
    '',
    'If you did not request this, ignore this email: your current password remains valid.',
  ].join('\n');

  return { subject: 'LaPrizza - Recuperação de password / Password Recovery', text };
}
