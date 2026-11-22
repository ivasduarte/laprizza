# SYS07 - Minimum Business Continuity Objective (MBCO)

## 1. Minimum Service Capacity & Degraded Operation
* **Measurable Minimum Service Capacity:** The system must maintain the ability to read and serve existing operational documents from `/srv/laprizza-shared` to authenticated users at a minimum rate of 50 requests per minute.
* **Capabilities Available During Degraded Operation:** If the shared folder system fails, the core LaPrizza ordering and catalog system remains fully operational.
* **Maximum Acceptable Downtime (MAD):** 24 hours for the shared resource folder, as it handles operational documentation rather than real-time customer orders.

### Staging network access (SYS02, SYS03)

* **Measurable Minimum Service Capacity:** the staging API stays reachable from every approved network (ISEP VPN `10.8.0.0/16`, DEI network `10.9.0.0/16`) and from the VM itself; an invalid change of the allowed endpoints never reduces that access (0 minutes of downtime), and a valid change is applied within 1 minute of being saved, without restarting nginx or the API.
* **Capabilities Available During Degraded Operation:** if the apply service (`laprizza-allowlist.path` / `.service`) fails, nginx keeps the last valid rules: approved clients keep working and unapproved ones keep being refused, but new changes are not applied until the service is repaired. SSH administration does not depend on the allowlist, so it stays available to fix it.
* **Maximum Acceptable Downtime (MAD):** 15 minutes of lost access for the approved networks after a wrong but valid change, the time for an administrator to connect by SSH and revert it with the diff recorded in `allowlist.log`.

## 2. Alignment and Recovery Validation
* **Alignment with Risks/Backups:** The 24-hour MAD aligns with the daily backup frequency of the `/srv/laprizza-shared` directory (SYS08), mitigating the risk of disk exhaustion or file corruption (SYS06).
* **Recovery Exercises & Shortfalls:** Recovery exercises demonstrate that a `.tar.gz` backup of the `/srv/laprizza-shared` folder can be extracted and have its `deploy:deploy` ownership and `750` permissions reapplied well within the MAD. No significant shortfalls identified for this module.
* **Alignment for the allowed endpoints (SYS03):** the targets answer the SYS06 risks "Allowed-endpoints change blocks legitimate clients" and "Unauthorized or too broad allowed-endpoints change". The last valid configuration is kept in `/var/lib/laprizza/allowlist/last-valid.conf` and the SYS02 original in `allowed-endpoints.conf.sys02-original`.
* **Recovery exercises (SYS03):** a network was removed and added back with `laprizza-allowlist-edit` (403 and then 200, [SYS03 evidence 3](allowed-endpoints/allowed-endpoints.md#evidence)), and an invalid change was refused while the API kept answering 200 (evidence 4), so the 0-minute target for invalid changes is met. The 15-minute revert target has not been timed yet.
* **Shortfall (SYS03):** the SYS08 backup does not include `/etc/laprizza/allowed-clients.conf`, `/var/lib/laprizza/allowlist/` or `/var/log/laprizza/allowlist.log`; if the VM were rebuilt, the allowed networks and their change history would be lost. Proposal: add these paths to the daily archive of SYS08.

## 3. Stakeholder Review
* **Proposed Targets:** 
  * Maximum Acceptable Downtime (MAD) for Shared Folder: 24 hours.
  * Shared Resource File Retention: 90 days.
  * Staging network access: 0 minutes of downtime from an invalid allowed-endpoints change; a valid change applied within 1 minute; at most 15 minutes to revert a wrong valid change.
* **Approved Targets:** 
  * [Pending]