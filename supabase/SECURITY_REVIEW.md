# ElderLink Database Security Review & Hardening Audit

## Executive Summary

Following a comprehensive internal security audit of the initial ElderLink database architecture (`001_initial_schema.sql`), critical vulnerabilities and design flaws were discovered in privilege validation, identity resolution, invitation lifecycle, log attribution, and function execution permissions.

This document details the vulnerabilities identified, their potential impact, root causes, and the concrete technical mitigations implemented in the hardened migration.

---

## Vulnerabilities Identified & Resolved

### 1. Care Circle Membership Privilege Escalation
* **Severity**: High (Critical)
* **Root Cause**: The original `care_circle_members` INSERT policy permitted any user with `can_manage_members = true` to directly insert records into `care_circle_members`. Malicious or compromised members could insert records granting themselves or third parties full `can_manage_medications`, `can_manage_appointments`, or elevated roles (`role = 'caretaker'`), effectively bypassing owner authority.
* **Remediation**:
  - Direct `INSERT` on `care_circle_members` is now strictly restricted to the primary **elder owner** (`is_elder_owner(elder_profile_id)`).
  - All non-owner members (caretakers, family) must join exclusively via the single-use `accept_care_invitation()` server RPC.
  - `accept_care_invitation()` assigns permissions derived exclusively from the pre-approved `assigned_role` on the locked invitation row.
  - Permission flags on `care_circle_members` can never be escalated through client-side inserts.

---

### 2. Arbitrary Identity Trust in `SECURITY DEFINER` Helper Functions
* **Severity**: High
* **Root Cause**: Helper functions (`is_elder_owner`, `is_care_circle_member`, `has_elder_permission`, `can_record_medication_log`, `shares_care_circle_with`) accepted an optional `user_id UUID DEFAULT auth.uid()`. Malicious callers could supply arbitrary victim UUIDs to probe permissions, bypass authorization boundaries, or confuse execution contexts.
* **Remediation**:
  - Removed all `user_id` arguments from authorization helper functions.
  - Identity is now derived strictly and immutably from `auth.uid()` within the function body (`v_uid UUID := auth.uid()`).
  - Added strict `search_path = public, pg_temp` on all `SECURITY DEFINER` routines to prevent malicious search path hijacking.

---

### 3. Blanket Function Execution Privileges & Oracle Exposure
* **Severity**: Medium-High
* **Root Cause**:
  - `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;` granted blanket rights to all application users.
  - `hash_invitation_code` was exposed as an unrestricted public hashing oracle.
  - Internal triggers (`handle_new_user`, `handle_updated_at`) were callable directly via PostgREST RPC by application users.
* **Remediation**:
  - Revoked blanket `EXECUTE` from `PUBLIC`, `anon`, and `authenticated`.
  - Revoked execution on trigger functions from all application roles.
  - Replaced the client-side hashing oracle with an atomic server RPC `create_care_invitation()` that generates 128-bit cryptographic entropy via `extensions.gen_random_bytes(16)` and only stores the SHA-256 hash.
  - Explicitly granted execution only for necessary RLS helpers and the invitation RPCs to the `authenticated` role.

---

### 4. Invitation Lifecycle Vulnerabilities & Hash Exposure
* **Severity**: High
* **Root Cause**:
  - `invitation_code_hash` was readable by any authenticated member who could select from `care_invitations`.
  - Invitations could be accepted multiple times (race conditions) or by unintended users because email matching was not enforced and rows were not locked.
  - Direct `UPDATE` was permitted on `care_invitations`.
* **Remediation**:
  - **Column-Level Revocation**: Revoked `SELECT` on `care_invitations` and re-granted `SELECT` only on non-sensitive columns (`id`, `elder_profile_id`, `invited_email`, `assigned_role`, `expires_at`, `accepted_at`, `created_by`, `created_at`). `invitation_code_hash` is now completely unreadable by clients.
  - **Atomic Row Locking**: `accept_care_invitation` locks the target invitation record using `FOR UPDATE`, ensuring single-acceptance atomicity and defeating race conditions.
  - **Email Binding**: If `invited_email` is set, `accept_care_invitation` verifies case-insensitively (`lower(trim(invited_email)) = lower(trim(caller_email))`) that the accepting user's email matches the invited email.
  - **Owner Self-Acceptance & Duplicate Prevention**: Explicitly rejects acceptance if the user is already the owner or an existing circle member.
  - **Forbidden Direct Updates**: Removed direct `UPDATE` on `care_invitations`; cancellations are executed via `revoke_care_invitation()` or deletion policies.

---

### 5. Unattributed Medication Logs
* **Severity**: Medium
* **Root Cause**: The INSERT policy allowed `(recorded_by = auth.uid() OR recorded_by IS NULL)`. A rogue client could insert adherence logs anonymously without attributing their user ID, corrupting clinical audit trails.
* **Remediation**:
  - Authenticated clients MUST provide `recorded_by = auth.uid()`. Logs with `recorded_by IS NULL` are rejected by RLS.
  - Supabase `service_role` scheduled jobs bypass RLS and retain the ability to generate automated missed-dose logs.
  - Caretakers are restricted to updating only their own recorded logs; elder owners retain administrative override.

---

### 6. Healthcare Record Reassignment & Cross-Elder Leakage
* **Severity**: High
* **Root Cause**: While composite foreign keys existed, an authenticated user updating an appointment or medication record could attempt to change `elder_profile_id` to transfer records between care circles.
* **Remediation**:
  - Implemented `prevent_record_reassignment()` trigger attached `BEFORE UPDATE` on `medications`, `medication_schedules`, `medication_logs`, `appointments`, and `care_invitations`. Any attempt to modify `elder_profile_id` triggers an immediate PostgreSQL exception.
  - Implemented `prevent_identity_reassignment()` trigger on `elder_profiles` (preventing transfer of `owner_user_id`) and `care_circle_members` (preventing transfer of `member_user_id`).
  - Preserved composite foreign keys `(medication_id, elder_profile_id)` and `(schedule_id, elder_profile_id)`.

---

### 7. Timezone Degradation in Timestamp Assignment
* **Severity**: Low-Medium
* **Root Cause**: `timezone('utc'::text, now())` converts a `TIMESTAMPTZ` into a `TIMESTAMP WITHOUT TIME ZONE`. When written back to a `TIMESTAMPTZ` column, PostgreSQL re-interprets it through the active connection timezone, introducing timestamp drift.
* **Remediation**:
  - Replaced all timezone-stripping expressions with native `now()`, which returns exact UTC `TIMESTAMPTZ`.
  - Preserved `Asia/Kolkata` as the default schedule timezone on `medication_schedules.timezone`.

---

### 8. Schema-to-TypeScript Discrepancies
* **Severity**: Low
* **Root Cause**: `types/database.types.ts` declared database enums in `Database['public']['Enums']` that did not exist as PostgreSQL types, while required INSERT fields were marked optional.
* **Remediation**:
  - Synchronized `types/database.types.ts` with the actual schema: `Database['public']['Enums']` is empty (`{ [_ in never]: never }`), matching CHECK constraint design.
  - Made required INSERT columns mandatory in TypeScript types.
  - Updated RPC argument signatures to match hardened SQL function signatures.

---

## Security Architecture Matrix

| Layer | Protection Mechanism | Enforced At |
| :--- | :--- | :--- |
| **Authentication** | JWT signature verification and `auth.uid()` extraction | Supabase Auth & PostgreSQL Session |
| **Row Isolation** | Tenant isolation by `elder_profile_id` via RLS | PostgreSQL Policy Engine |
| **Privilege Boundaries** | Owner vs Caretaker vs Family granular permissions | `has_elder_permission()` Helper & RLS |
| **Audit Integrity** | `recorded_by = auth.uid()` mandatory attribution | `medication_logs` RLS INSERT policy |
| **Immutability** | Foreign key & parent reference mutation lock | `prevent_record_reassignment()` Trigger |
| **Invitation Secrets** | 128-bit CSPRNG, SHA-256 hash storage, Column-level Revoke | `care_invitations` & `create_care_invitation` |
| **Replay Protection** | `FOR UPDATE` lock, expiration check, single acceptance | `accept_care_invitation` RPC |
