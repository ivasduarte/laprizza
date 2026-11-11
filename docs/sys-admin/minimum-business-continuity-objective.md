# SYS07 - Minimum Business Continuity Objective (MBCO)

## 1. Minimum Service Capacity & Degraded Operation
* **Measurable Minimum Service Capacity:** The system must maintain the ability to read and serve existing operational documents from `/srv/laprizza-shared` to authenticated users at a minimum rate of 50 requests per minute.
* **Capabilities Available During Degraded Operation:** If the shared folder system fails, the core LaPrizza ordering and catalog system remains fully operational.
* **Maximum Acceptable Downtime (MAD):** 24 hours for the shared resource folder, as it handles operational documentation rather than real-time customer orders.

## 2. Alignment and Recovery Validation
* **Alignment with Risks/Backups:** The 24-hour MAD aligns with the daily backup frequency of the `/srv/laprizza-shared` directory (SYS08), mitigating the risk of disk exhaustion or file corruption (SYS06).
* **Recovery Exercises & Shortfalls:** Recovery exercises demonstrate that a `.tar.gz` backup of the `/srv/laprizza-shared` folder can be extracted and have its `deploy:deploy` ownership and `750` permissions reapplied well within the MAD. No significant shortfalls identified for this module.

## 3. Stakeholder Review
* **Proposed Targets:** 
  * Maximum Acceptable Downtime (MAD) for Shared Folder: 24 hours.
  * Shared Resource File Retention: 90 days.
* **Approved Targets:** 
  * [Pending]