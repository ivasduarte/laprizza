# SYS04 – Shared Resource Folder

Requirement: document the folder location and permissions, and audit access; restricted information must not be placed in the folder (Sprint 2 User Stories v1.0, p. 20). The endpoints are documented in OpenAPI (`/api/v1/docs`).

## Location

| Item | Value |
|---|---|
| Path (staging VM) | `/srv/laprizza-shared` |
| Configuration | `SHARED_DIR` in `/opt/laprizza/.env` |
| Owner / mode | `deploy:deploy`, `750` |
| Accessed by | `laprizza-api.service` (runs as user `deploy`) |

The folder is outside `/opt/laprizza/releases`, so deployments and rollbacks do not touch it. It is reachable only through the API, never as a network share.

## Permissions (To be Updated)

| Actor | List / download | Upload / replace / delete |
|---|---|---|
| Guest (no session) | No (`401`) | No (`401`) |
| Customer, Employee | Yes | No (`403`) |
| Manager | Yes | Yes |

## Audit

Each operation is recorded by the security logger as one JSON line:

```json
{"timestamp":"…","type":"SECURITY","event":"SHARED_RESOURCE_ACCESS","userId":"…","ip":"…","action":"UPLOAD","file":"manual.txt","result":"OK"}
```

- `action`: `LIST`, `DOWNLOAD`, `UPLOAD` or `DELETE`; `result`: `OK` or `ERROR_<status>`.
- Requests without a valid session or without the required role are recorded as `ACCESS_DENIED`.
- Fields whose name contains `pass`, `token`, `secret`, `cookie`, `authorization` or `hash` are never logged (`security-logger.js`).
- Logs go to the journal of `laprizza-api.service`:

```bash
journalctl -u laprizza-api | grep -E "SHARED_RESOURCE_ACCESS|ACCESS_DENIED"
```

Retention: 90 days (persistent journal, `MaxRetentionSec=90day`).

## Restricted content

Customer records, dietary profiles, credentials, backup contents and other restricted information must not be placed in the folder. Only the Manager can add files, only a fixed list of file types is accepted, and the upload form displays this warning. The file name is checked wether or not it contains certain keywords. Furthermore, the bytes are validated to ensure file types are not changed (subtmit a .bson file with a .pdf extension).
