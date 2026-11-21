# SYS06 - Operational Risk Assessment

## Quantification

Likelihood and impact use a three-level scale: Low = 1, Medium = 2, High = 3. **Risk score = Likelihood × Impact** (1-9): 1-2 low, 3-4 medium, 6-9 high. The remaining risk is assessed after the mitigation measures. The responsible person is the team member who holds the role named in each row (to be filled with the name by the team).

| Risk | L | I | Score |
|:---|:-:|:-:|:-:|
| Disk space exhaustion | 2 | 2 | 4 |
| OS-level file corruption | 1 | 3 | 3 |
| MongoDB data loss or corruption | 1 | 3 | 3 (6 while the database has no backup) |
| TLS certificate expired or missing | 2 | 3 | 6 |
| Loss of environment configuration | 1 | 3 | 3 |
| Unauthorized file deletion | 2 | 2 | 4 |
| Faulty release deployed | 2 | 2 | 4 |
| Unauthorized SSH access / brute force | 3 | 3 | 9 |
| Privilege escalation in the shared folder | 1 | 3 | 3 |
| Accidental upload of customer data | 2 | 3 | 6 |
| Leak of personal data | 1 | 3 | 3 |
| Account takeover in the web application | 2 | 3 | 6 |

## 1. Technical Risks

| Risk | Affected Services/Information | Likelihood | Impact | Responsible Person | Supporting Evidence | Mitigation Measures | Remaining Risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Disk space exhaustion | `/srv/laprizza-shared` folder availability | Medium | Medium | System Administrator | Uploads consume disk space over time. | Implement disk quotas for the `deploy` user and automated monitoring/alerts. | Low | 
| OS-level file corruption | Shared resources (documents/reports) | Low | High | System Administrator | Files are stored locally on the VM at `/srv/laprizza-shared`. | Regular backups if needed of the `/srv` directory. | Low |
| MongoDB data loss or corruption (personal data integrity and availability) | Customers, users, sessions, configurations, forecasts | Low | High | System Administrator | MongoDB runs on one VM; the backup strategy (SYS08) covers `/srv/laprizza-shared` only, not the database. | Daily `mongodump` with restricted access, included in the restore tests of SYS08. | **High until implemented** |
| TLS certificate expired or missing on a VM | Every web user (HTTPS is required for the session cookie, AA04) | Medium | High | System Administrator | `deploy/nginx/laprizza.conf` serves only HTTPS; see `docs/sys-admin/https.md`. | Calendar reminder 30 days before expiry; `nginx -t` and the deploy health check over HTTPS. | Low |


## 2. Operational Risks

| Risk | Affected Services/Information | Likelihood | Impact | Responsible Person | Supporting Evidence | Mitigation Measures | Remaining Risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Loss of Environment Configuration | Web Application integration with the Shared Folder | Low | High | System Administrator | `SHARED_DIR=/srv/laprizza-shared` is stored in `/opt/laprizza/.env` and could be overwritten during updates. | Version control for infrastructure configurations; include `.env` in backup routines. | Low | 
| Unauthorized File Deletion | Files inside `/srv/laprizza-shared` | Medium | Medium | System Administrator | The `deploy` user has full write/delete access (`750` permissions). | Restrictions on who can issue delete commands via API. | Low |
| Faulty release deployed to production | Web Application and API | Medium | Medium | System Administrator | Automatic deployment (SYS01) from the repository (cron). | `laprizza-deploy-web.sh` validates the published version with a health check, discards a failed release and keeps the last 5 releases for `rollback` (SYS01). | Low |


## 3. Security Risks (Includes Personal Data Risks)

| Risk | Affected Services/Information | Likelihood | Impact | Responsible Person | Supporting Evidence | Mitigation Measures | Remaining Risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Unauthorized SSH Access / Brute Force Attack | Entire VM Infrastructure | High | High | System Administrator | Public-facing IPs are constantly scanned and targeted by automated SSH dictionary attacks. | (SYS05) Restrict SSH to `ssh-admins`, enforce MFA, use `faillock` for account lockout, and trigger automated email alerts on failures. | Low |
| Privilege Escalation / Unauthorized Access (Confidentiality) | Confidential operational documents | Low | High | System Administrator | Folder relies on `750` mode and `deploy` group. Misconfiguration could expose files. | Regular audits of directory permissions using `ls -ld /srv/laprizza-shared`. | Low |
| Accidental upload of Customer Data (Integrity/Confidentiality) | Personal Data Compliance | Medium | High | Data Protection Officer (DPO) / System Admin | Strictly forbidden that customer records/credentials get uploaded to this folder. | Strict API validation preventing upload of restricted formats; team training. | Medium |
| Leak of personal data from the database or a backup copy (confidentiality) | Customer records (contacts, address, dietary restrictions), user e-mails | Low | High | System Administrator / Data Protection contact | Personal data inventory in `docs/gdpr/personal-data-handling.md`. | nginx exposes only the SPA and `/api/` (the database is never proxied), no IPs in logs, backup archives with `600` root-only permissions (SYS08), breach procedure (GDP03). | Low |
| Account takeover in the web application (credential stuffing) | Manager and Administrator accounts | Medium | High | Development Team | Public production site (`vs-gate`). | Argon2 hashes, progressive lockout and per-IP rate limit (AA01), revocable sessions with idle timeout (AA04). | Low |
