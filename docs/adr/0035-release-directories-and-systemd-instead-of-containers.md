# Release Directories and systemd instead of Containers

* Status: accepted
* Deciders: Development Team
* Date: 2026-11-04

Technical Story: [SYS01] Automated Deployment and Validation

## Context and Problem Statement

The pipeline of [ADR-0034](./0034-pull-based-deployment-from-the-staging-vm.md) needs a deployment unit: something that holds one version of the back end, can be activated atomically and can be replaced by the previous version when the new one is unhealthy. The first plan was a Docker image per commit run with Docker Compose.

The staging VM was created from the DEI template "Ubuntu 24.04 LTS – base system", which is an LXD container. Docker installs, but cannot start containers there, because the container does not allow the overlay file system:

```text
docker: Error response from daemon: failed to mount … mount source: "overlay" … err: permission denied
```

A QEMU/KVM virtual server would run Docker, but costs twice as much of the team's DEI quota. We must decide how each version is stored, run and replaced on this VM.

## Decision Drivers

* Each version built from an exact commit, with locked dependencies (reproducible).
* Atomic activation and a rollback in seconds.
* Run as an unprivileged account, with the secrets outside the code ([ADR-0018](./0018-secrets-management-strategy.md)).
* Work on the existing LXD container, without a new VM or more quota.

## Considered Options

* Docker images on the LXD container
* Docker with the `vfs` storage driver
* A QEMU/KVM VM with Docker
* One folder updated in place (`git pull` and PM2)
* One directory per release, a `current` symlink and a systemd service

## Decision Outcome

Chosen option: "One directory per release, a `current` symlink and a systemd service", because it gives the isolation and rollback we needed from images on the VM we already have.

* A release is `/opt/laprizza/releases/<sha>/`: the `backend/` folder of that commit (`git archive`), its dependencies (`npm ci`, then `npm prune --omit=dev`) and a `VERSION.json` (sha, branch, commit date, deployment date) served by `GET /version`.
* `/opt/laprizza/current` points to the running release and is switched atomically (`ln -s` to a temporary name, then `mv -T`).
* `laprizza-api.service` runs `node src/index.js` from `current` as the `deploy` account, reads the secrets from `/opt/laprizza/.env` (`EnvironmentFile=`, mode `600`) and listens on `127.0.0.1:3000` behind nginx. The only privilege of `deploy` is a sudoers rule to restart and query this service.
* After the switch the service is restarted and must answer `/health` (2xx) and `/version` with the new sha within 60 seconds; otherwise `current` goes back to the previous release, which is checked the same way. A failed release is deleted, so it can never be chosen by a later rollback.
* The last five releases are kept; `laprizza-deploy.sh rollback [sha]` switches back to one of them. Database migrations are not reverted, so they must stay backward compatible with the previous release.

### Positive Consequences

* Works on the existing LXD container, without more quota.
* A rollback is a symlink switch and a restart: a few seconds, no image registry.
* Each release is built from one commit with locked dependencies and never changes afterwards.
* The running version is always identifiable (`current`, `VERSION.json`, `/version`).

### Negative Consequences

* Node.js and the OS packages are shared by every release instead of being part of an image; they are pinned and documented.
* Native dependencies (for example `argon2`) are built against the Node.js of the VM.
* Releases are isolated by directory and service account, not by a container.
* A rollback across an incompatible migration needs a manual `migrate:down`.

## Pros and Cons of the Options

### Docker images on the LXD container

* Good, because images are the usual unit of deployment and rollback.
* Bad, because the container refuses the overlay mount.

### Docker with the `vfs` storage driver

* Good, because it avoids the overlay mount.
* Bad, because it is slow, uses a full copy of every layer and is likely to hit other permission errors in the container.

### QEMU/KVM VM with Docker

* Good, because Docker works without restrictions.
* Bad, because it doubles the quota used, for no other benefit to this module.

### One folder updated in place

* Good, because it is the simplest.
* Bad, because a failed update leaves a half-updated folder, there is no atomic switch and a rollback depends on the Git state of the folder.

### Release directories, symlink and systemd

* Good, because it gives atomic activation, fast rollback and an unprivileged service with tools already on the VM.
* Bad, because the runtime is shared and must be pinned by hand.