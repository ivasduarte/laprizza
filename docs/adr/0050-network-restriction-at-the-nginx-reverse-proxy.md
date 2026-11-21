# Network Restriction at the nginx Reverse Proxy

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-08

Technical Story: [SYS02] Institutional Network Access Restriction

## Context and Problem Statement

The staging back end runs on the DEI virtual server `laprizza-backend` (`10.9.22.22`), deployed by SYS01 ([ADR-0048](./0048-pull-based-deployment-from-the-staging-vm.md), [ADR-0049](./0049-release-directories-and-systemd-instead-of-containers.md)). SYS02 requires that access to development and staging be limited to the DEI internal network or the ISEP VPN, with host or proxy rules; that access from any other network be denied **and logged**; and that the application's authentication and role checks stay active.

The approved networks are the ISEP VPN (`10.8.0.0/16`) and the DEI internal network (`10.9.0.0/16`). The VM is an unprivileged LXD container created from a DEI template, so the team does not control the host's packet filter. Where should the HTTP rule be enforced?

## Decision Drivers

* Deny every address outside the approved networks before the request reaches the API.
* Log every refusal with the client address, in a place the administrators already read.
* Change the allowed networks without restarting the API (later required by SYS03).
* Work inside the LXD container with the tools already installed.
* Keep authentication and authorization in the application, unchanged.
* The API must see the real client address (rate limits, lockout, security logs).

## Considered Options

* Rely on the DEI network only (private addresses, VPN)
* Host firewall on the VM (`ufw` / `iptables`)
* IP filter middleware in the Express application
* nginx reverse proxy with `allow`/`deny` rules, API bound to `127.0.0.1`

## Decision Outcome

Chosen option: "nginx reverse proxy with `allow`/`deny` rules, API bound to `127.0.0.1`", because it denies and logs at the single HTTP entry point, can be reloaded without restarting anything, and does not depend on privileges the container does not have.

* nginx listens on port 80 and forwards `/api/` to `http://127.0.0.1:3000`.
* The site includes `/etc/laprizza/allowed-endpoints.conf`: `allow 127.0.0.1; allow ::1; allow 10.8.0.0/16; allow 10.9.0.0/16; deny all;`. A refused client gets `403 Forbidden`, and nginx writes `access forbidden by rule, client: <address>` to `/var/log/nginx/laprizza.error.log`.
* The API listens only on `127.0.0.1` (`HOST=127.0.0.1`), so it cannot be called without going through nginx.
* `TRUST_PROXY=loopback,10.9.23.46`: Express accepts `X-Forwarded-For` only from the local nginx and the staging front-end VM (whose nginx forwards `/api/` to this nginx), so it gets the real client address and a client cannot forge it.
* Authentication (JWT) and the permission matrix ([ADR-0046](./0046-permission-based-authorization-matrix.md)) are not changed.
* The rules file is separate from the site, so the list of networks can be maintained on its own (SYS03 now generates it from `/etc/laprizza/allowed-clients.conf`).

### Positive Consequences

* One place for the HTTP rule, with standard and well-known syntax.
* Refusals are logged with the client address; allowed requests are in the access log.
* `nginx -t` + `systemctl reload nginx` apply a change without dropping connections or restarting the API.
* The API cannot be reached directly from the network.

### Negative Consequences

* Only HTTP through nginx is covered; SSH needs its own rule ([ADR-0051](./0051-ssh-restricted-to-approved-networks-with-allowusers.md)).
* A wrong `TRUST_PROXY` value would make every client appear as one address or let clients forge their address; it lists the trusted proxies and must be updated if the front-end VM changes address.
* `10.9.0.0/16` includes every DEI virtual server, not only the team's.

## Pros and Cons of the Options

### Rely on the DEI network only

* Good, because nothing has to be configured: the VMs have private addresses only.
* Bad, because the team has no rule of its own, no log of refused clients and no way to narrow the allowed networks.

### Host firewall on the VM

* Good, because it covers every port with one rule set.
* Bad, because in an unprivileged LXD container it depends on netfilter support delegated by the DEI host, which the team does not control.
* Bad, because dropped packets are logged by the kernel, not with the HTTP request, and a mistake can cut SSH access to the VM.

### IP filter middleware in Express

* Good, because it is written in the language of the project and is easy to test.
* Bad, because a change of the allowed networks needs a new deployment or a restart, and every refused request still uses the API.
* Bad, because the address check depends on `trust proxy` being right inside the same process that is being protected.

### nginx `allow`/`deny`, API on `127.0.0.1`

* Good, because nginx is already the entry point, logs refusals and reloads without a restart.
* Bad, because it only protects what goes through nginx.