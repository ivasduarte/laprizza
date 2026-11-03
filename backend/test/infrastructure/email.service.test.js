import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmailService } from '../../src/infrastructure/email/email.service.js';

const CONFIG = { host: 'localhost', port: 1025, secure: false, from: 'LaPrizza <no-reply@laprizza.local>' };

/** Fake nodemailer transport that records the messages. */
function createFakeTransport({ fail = false } = {}) {
  const messages = [];
  return {
    messages,
    async sendMail(message) {
      if (fail) throw new Error('SMTP unavailable');
      messages.push(message);
      return { messageId: 'test' };
    },
  };
}

/**
 * Unit test: send delivers the message to the transport with the configured sender.
 */
test('send uses the configured sender and forwards the message', async () => {
  const transport = createFakeTransport();
  const service = createEmailService(CONFIG, transport);

  await service.send({ to: 'user@laprizza.pt', subject: 'Assunto', text: 'Corpo' });

  assert.deepEqual(transport.messages, [
    {
      from: CONFIG.from,
      to: 'user@laprizza.pt',
      subject: 'Assunto',
      text: 'Corpo',
      html: undefined,
    },
  ]);
});

/**
 * Unit test: transport errors propagate (the caller decides what to do).
 */
test('send propagates transport errors', async () => {
  const service = createEmailService(CONFIG, createFakeTransport({ fail: true }));
  await assert.rejects(() => service.send({ to: 'a@b.pt', subject: 's', text: 't' }), /SMTP unavailable/);
});

/**
 * Unit test: without an injected transport a nodemailer one is created (does not connect on creation).
 */
test('createEmailService builds a nodemailer transport by default', () => {
  const service = createEmailService(CONFIG);
  assert.equal(typeof service.send, 'function');
});
