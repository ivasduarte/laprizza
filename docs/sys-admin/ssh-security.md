# SYS05 – SSH Security and Access Control

Requirement: Secure SSH access using a specific admin group, enforce Multi-Factor Authentication (MFA), implement account lockout mechanisms for failed attempts, and configure automated email alerts for blocked accounts.

## 1. Access Control
* **Allowed Group:** `ssh-admins`
* **Configuration:** Only users belonging to the `ssh-admins` group are allowed to initiate an SSH connection. Users outside this group are rejected by the SSH daemon before credential validation.

## 2. Multi-Factor Authentication (MFA)
* **Mechanism:** Google Authenticator (Time-based One-Time Password - TOTP).
* **Enforcement:** Enforced via Pluggable Authentication Modules (PAM) in `/etc/pam.d/sshd` using the `pam_google_authenticator.so` module.
* **Condition:** The `nullok` directive is omitted. MFA is strictly required. Users without a configured `.google_authenticator` file in their home directory are immediately denied access.

## 3. Intrusion Prevention (Account Lockout)
* **Mechanism:** `pam_faillock.so`
* **Behavior:** The system tracks failed authentication attempts. After reaching the defined threshold (e.g., 4 consecutive failed attempts), the target account is locked to prevent brute-force attacks.
* **Management:** The system administrator can audit locked accounts, view failure records, or reset access using the `faillock` utility (`sudo faillock --user <username>`).

## 4. Automated Security Alerts
* **Trigger Mechanism:** `pam_exec.so`
* **Script Location:** `/usr/local/sbin/ssh-alert.sh`
* **Workflow:** 
  1. When an account is locked out by `faillock`, PAM automatically triggers the alert script.
  2. The script captures the attack context from PAM environment variables (Targeted User: `$PAM_USER`, Source IP: `$PAM_RHOST`, Service: `$PAM_SERVICE`).
  3. An alert email is dispatched to the system administrator (`laprizzag01@gmail.com`) using the local Postfix SMTP server, which relays the message through Google's SMTP (port 587) using an App Password configuration (`SASL`).
## 5. SYS05 acceptance criteria (status)

The configuration of the VM is not stored in the repository, so the evidence below must be collected on the VM and attached here (screenshots or log excerpts).

| Criterion | Documented above | Evidence |
|---|---|---|
| Authentication only between 08:00 and 22:00 local time, denied outside | **Not documented** (e.g. `pam_time.so` with `/etc/security/time.conf`, or `AllowUsers` with a time rule) | Pending: one allowed and one denied login |
| Deployed timezone | **Not documented** (`timedatectl` output, expected `Europe/Lisbon`) | Pending |
| MFA after a failed attempt | MFA (TOTP) is required on every login (section 2), which also covers this criterion | Pending: login with MFA |
| E-mail alert after more than three consecutive failures | Lockout at 4 failures triggers `ssh-alert.sh` (sections 3 and 4) | Pending: received alert |
| Individually identifiable administrative accounts, no shared credentials | **Not documented** (one account per member in `ssh-admins`) | Pending: `getent group ssh-admins` |
| Login and alert records only for authorized personnel, with a retention period | **Not documented** (permissions and rotation of `/var/log/auth.log`, e.g. `logrotate` 90 days) | Pending |
