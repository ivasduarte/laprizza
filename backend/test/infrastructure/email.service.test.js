import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createEmailService } from '../../src/infrastructure/email/email.service.js';

const CONFIG = { host: 'localhost', port: 1025, secure: false, from: 'LaPrizza <no-reply@laprizza.local>' };

/** Mocked nodemailer transport. */
function createTransportMock() {
  return { sendMail: mock.fn(async () => ({ messageId: 'test' })) };
}

/**
 * Unit test: send delivers the message to the transport with the configured sender.
 */
test('send uses the configured sender and forwards the message', async () => {
  const transport = createTransportMock();
  const service = createEmailService(CONFIG, transport);

  await service.send({ to: 'user@laprizza.pt', subject: 'Assunto', text: 'Corpo' });

  assert.equal(transport.sendMail.mock.callCount(), 1);
  assert.deepEqual(transport.sendMail.mock.calls[0].arguments[0], {
    from: CONFIG.from,
    to: 'user@laprizza.pt',
    subject: 'Assunto',
    text: 'Corpo',
    html: undefined,
  });
});

/**
 * Unit test: transport errors propagate (the caller decides what to do).
 */
test('send propagates transport errors', async () => {
  const transport = createTransportMock();
  transport.sendMail.mock.mockImplementation(async () => {
    throw new Error('SMTP unavailable');
  });
  const service = createEmailService(CONFIG, transport);

  await assert.rejects(() => service.send({ to: 'a@b.pt', subject: 's', text: 't' }), /SMTP unavailable/);
  assert.equal(transport.sendMail.mock.callCount(), 1);
});

/**
 * Unit test: without an injected transport a nodemailer one is created (does not connect on creation).
 */
test('createEmailService builds a nodemailer transport by default', () => {
  const service = createEmailService(CONFIG);
  assert.equal(typeof service.send, 'function');
});
