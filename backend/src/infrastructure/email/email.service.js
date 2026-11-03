import nodemailer from 'nodemailer';

export function createEmailService(config, transport) {
  const mailer =
    transport ??
    nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    });

  return {
    async send({ to, subject, text, html }) {
      await mailer.sendMail({ from: config.from, to, subject, text, html });
    },
  };
}
