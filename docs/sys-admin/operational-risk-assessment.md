# SYS06 - Operational Risk Assessment

## 1. Technical Risks

| Risk | Affected Services/Information | Likelihood | Impact | Responsible Person | Supporting Evidence | Mitigation Measures | Remaining Risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Disk space exhaustion | `/srv/laprizza-shared` folder availability | Medium | Medium | System Administrator | Uploads consume disk space over time. | Implement disk quotas for the `deploy` user and automated monitoring/alerts. | Low | 
| OS-level file corruption | Shared resources (documents/reports) | Low | High | System Administrator | Files are stored locally on the VM at `/srv/laprizza-shared`. | Regular backups if needed of the `/srv` directory. | Low |

## 2. Operational Risks

| Risk | Affected Services/Information | Likelihood | Impact | Responsible Person | Supporting Evidence | Mitigation Measures | Remaining Risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Loss of Environment Configuration | Web Application integration with the Shared Folder | Low | High | System Administrator | `SHARED_DIR=/srv/laprizza-shared` is stored in `/opt/laprizza/.env` and could be overwritten during updates. | Version control for infraestructure configurations; include `.env` in backup routines. | Low | 
| Unauthorized File Deletion | Files inside `/srv/laprizza-shared` | Medium | Medium | System Administrator | The `deploy` user has full write/delete access (`750` permissions). | Restrictions on who can issue delete commands | Low |

## 3. Security Risks (Includes Personal Data Risks)

| Risk | Affected Services/Information | Likelihood | Impact | Responsible Person | Supporting Evidence | Mitigation Measures | Remaining Risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Privilege Escalation / Unauthorized Access (Confidentiality) | Confidential operational documents | Low | High | System Administrator | Folder relies on `750` mode and `deploy` group. Misconfiguration could expose files. | Regular audits of directory permissions using `ls -ld /srv/laprizza-shared`. | Low |
| Accidental upload of Customer Data (Integrity/Confidentiality) | Personal Data Compliance | Medium | High | Data Protection Officer (DPO) / System Admin | Strictly forbidden that customer records/credentials gets uploaded to this folder. | Strict API validation preventing upload of restricted formats; team training. | Medium |

