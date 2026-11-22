# E-mail Delivery with Nodemailer and Mailpit

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-02

Technical Story: [AA01] Local Authentication

## Context and Problem Statement

AA01 sends password recovery links by e-mail, and AA06/AA07 later send activation invitations the same way. The project runs in development, test and demonstration environments where messages must never reach real people, but where developers and reviewers must still read the e-mails and click their links. The sending code must be reusable by other user stories and testable without a mail server.

## Decision Drivers

* No real e-mails during development, tests and demonstrations.
* Messages readable by humans (web interface) and by automated flows (API).
* One reusable, injectable e-mail service; no vendor lock-in.
* Passwords are never sent by e-mail.

## Considered Options

* Nodemailer with Mailpit (local SMTP sink) in every environment
* Nodemailer with a real SMTP provider (e.g. Gmail, SendGrid SMTP)
* A provider HTTP API and its SDK
* Writing the e-mail to the console log

## Decision Outcome

Chosen option: "Nodemailer with Mailpit in every environment", because it delivers real SMTP messages that can be read and clicked, without sending anything outside the machine.

* `EmailService` (`infrastructure/email/email.service.js`) exposes only `send({ to, subject, text, html })` over a Nodemailer transport created from `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` and `MAIL_FROM`. It is injected into the services, so tests use a fake transport.
* Each use case builds its own message (`password-reset-email.js` in AA01, `activation-invitation-email.js` in AA06), in Portuguese and English, as plain text. The messages carry links, never passwords.
* Mailpit is a service of the root `docker-compose.yml`: SMTP on port `1025`, web interface on `http://localhost:8025`. Its HTTP API lets the httpyac flows read the invitations (AA06/AA07).
* In production (VM `vs944`) Mailpit runs as a systemd service (`deploy/production/laprizza-mailpit.service`), bound to `127.0.0.1`, with the same ports. Its interface is read through an SSH tunnel; no e-mail leaves the VM.
* Sending never blocks or changes an answer: the password recovery sends after its `202`, and a failure is written to the security log.

### Positive Consequences

* Developers and reviewers read and click the real messages without any mailbox.
* Moving to a real provider only changes the `SMTP_*` variables.
* The same service is reused by AA01, AA06 and AA07.

### Negative Consequences

* Docker is needed to receive the e-mails locally.
* Nothing is delivered to real mailboxes; a production deployment needs an SMTP provider, its credentials in the secrets management of [ADR 0018](./0018-secrets-management-strategy.md), and SPF/DKIM.
* Mailpit keeps the messages, including recovery links, until they are deleted; it must not be exposed outside the development machine.

## Pros and Cons of the Options

### Nodemailer with Mailpit

* Good, because the messages are real, readable and clickable, and never leave the machine.
* Bad, because it needs Docker.

### Nodemailer with a real SMTP provider

* Good, because the messages reach real mailboxes.
* Bad, because tests could e-mail real people, and it needs accounts and credentials for every developer.

### Provider HTTP API and SDK

* Good, because of delivery reports and templates.
* Bad, because it ties the code to one vendor and needs an account and API keys.

### Console log

* Good, because it needs nothing.
* Bad, because recovery links would end up in the logs, against AA01 and AA05, and nobody can click them from an e-mail client.
