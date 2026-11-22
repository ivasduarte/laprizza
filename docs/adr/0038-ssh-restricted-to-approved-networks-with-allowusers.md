# SSH Restricted to Approved Networks with AllowUsers

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-08

Technical Story: [SYS02] Institutional Network Access Restriction

## Context and Problem Statement

Besides the API, the staging VM `laprizza-backend` is reached by the team over SSH, to administer it and to run deployments (SYS01). SYS02 requires that this access also be limited to the DEI internal network (`10.9.0.0/16`) or the ISEP VPN (`10.8.0.0/16`), and that refused attempts be logged. The nginx rule of [ADR-0037](./0037-network-restriction-at-the-nginx-reverse-proxy.md) does not cover SSH. A mistake in the SSH configuration can lock every administrator out of the VM, and the DEI console is the only way back.

## Decision Drivers

* Refuse SSH from any other network before authentication, and log it.
* Keep individual accounts and key authentication (one key per device); no root login, no passwords.
* Work inside the LXD container, without a host firewall.
* Changes must be testable without losing the current session.

## Considered Options

* sshd `AllowUsers` with network patterns (`*@10.8.0.0/16 *@10.9.0.0/16`)
* sshd `Match Address` blocks that deny everything else
* Host firewall rule for port 22
* TCP wrappers (`/etc/hosts.allow`)

## Decision Outcome

Chosen option: "sshd `AllowUsers` with network patterns", because it is one line in the SSH daemon itself, is checked before the key, and is logged by sshd with the user and the address.

```text
# /etc/ssh/sshd_config.d/99-laprizza.conf
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AllowUsers *@10.8.0.0/16 *@10.9.0.0/16
```

* A connection from any other address is closed and logged as `User <name> from <address> not allowed because not listed in AllowUsers` (`journalctl -u ssh`).
* The file lives in `sshd_config.d`, so it survives package updates of the main `sshd_config`.
* Every change is checked with `sudo sshd -t` and applied with `sudo systemctl reload ssh` while a second session stays open.
* Which accounts may log in (group `ssh-admins`, second factor, lockout) is handled by SYS05 ([ssh-security.md](../sys-admin/ssh-security.md)); `AllowUsers` only adds the network condition. When both `AllowUsers` and `AllowGroups` are set, a login must satisfy both.

### Positive Consequences

* Same approved networks as HTTP, enforced by the service that is being protected.
* Refusals are logged with the user name and the source address.
* No dependency on netfilter in the container.

### Negative Consequences

* The network list is repeated in two places (nginx and sshd); SYS03 only manages the nginx one.
* Port 22 still accepts the TCP connection before refusing it.
* `AllowUsers` replaces any implicit "all users" rule: an account not matching a pattern cannot log in, so the patterns use `*` and the account check is left to SYS05.

## Pros and Cons of the Options

### `AllowUsers` with network patterns

* Good, because it is a single, standard directive, checked before authentication and logged.
* Bad, because the network list is kept separately from the nginx one.

### `Match Address` blocks

* Good, because different options can be applied per network.
* Bad, because a deny-everything-else block is more lines and easier to get wrong than one `AllowUsers` line.

### Host firewall rule for port 22

* Good, because the TCP connection itself is refused.
* Bad, because it depends on netfilter in the LXD container and a mistake locks everyone out without a log in the SSH journal.

### TCP wrappers

* Good, because the syntax is simple.
* Bad, because current OpenSSH on Ubuntu is no longer built with libwrap, so `/etc/hosts.allow` has no effect.