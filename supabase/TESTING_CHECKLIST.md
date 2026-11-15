# ElderLink Database Security Testing Checklist

This checklist contains reproducible SQL test cases to verify the security controls implemented in `001_initial_schema.sql`.

Tests can be executed in the Supabase SQL Editor by simulating different user contexts with PostgreSQL session variables:
```sql
-- Simulate authenticated user session:
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SET ROLE authenticated;

-- Reset to admin / service role:
RESET request.jwt.claim.sub;
RESET ROLE;
```

---

## Pre-Test Setup: Test Identities & Seed Data

Run this block once as an administrator to create test personas:

```sql
BEGIN;

-- 1. Create simulated auth users
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'owner@elderlink.app', '{"full_name": "Alice Owner"}'),
  ('22222222-2222-2222-2222-222222222222', 'caretaker@elderlink.app', '{"full_name": "Bob Caretaker"}'),
  ('33333333-3333-3333-3333-333333333333', 'family@elderlink.app', '{"full_name": "Charlie Family"}'),
  ('44444444-4444-4444-4444-444444444444', 'intruder@elderlink.app', '{"full_name": "Eve Intruder"}')
ON CONFLICT (id) DO NOTHING;

-- 2. Create an Elder Profile owned by Alice
INSERT INTO public.elder_profiles (id, owner_user_id, full_name, date_of_birth, gender, blood_group)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Grandma Rose', '1945-05-12', 'female', 'O+')
ON CONFLICT (id) DO NOTHING;

-- 3. Add Bob as Caretaker in care_circle_members
INSERT INTO public.care_circle_members (elder_profile_id, member_user_id, role, can_view_medical_info, can_manage_medications, can_manage_appointments, can_manage_members)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'caretaker', true, true, true, true)
ON CONFLICT DO NOTHING;

-- 4. Create a Medication and Schedule
INSERT INTO public.medications (id, elder_profile_id, medication_name, dosage, unit, start_date)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Metformin', '500', 'mg', CURRENT_DATE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.medication_schedules (id, medication_id, elder_profile_id, scheduled_time, frequency)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '08:00:00', 'daily')
ON CONFLICT (id) DO NOTHING;

COMMIT;
```

---

## Test Cases

### Test 1: Caretaker Cannot Directly Insert Members (Privilege Escalation)
* **Goal**: Verify that even though Bob has `can_manage_members = true`, he CANNOT directly insert a member record with elevated permissions.
* **Execution**:
```sql
SET request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222'; -- Bob Caretaker
SET ROLE authenticated;

-- Attempt direct membership insert granting full permissions
INSERT INTO public.care_circle_members (
  elder_profile_id, member_user_id, role, can_view_medical_info, can_manage_medications, can_manage_appointments, can_manage_members
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '44444444-4444-4444-4444-444444444444', -- Eve Intruder
  'caretaker', true, true, true, true
);
```
* **Expected Result**: **FAIL** (`new row violates row-level security policy for table "care_circle_members"`). Only the elder owner may directly insert members.

---

### Test 2: Invitation Code Hash Is Protected From SELECT
* **Goal**: Verify that authenticated users cannot read the raw SHA-256 invitation hashes.
* **Execution**:
```sql
SET request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222'; -- Bob
SET ROLE authenticated;

-- Attempt to read invitation_code_hash
SELECT id, invitation_code_hash FROM public.care_invitations;
```
* **Expected Result**: **FAIL** (`permission denied for column invitation_code_hash of relation care_invitations`).

---

### Test 3: Invitation Cannot Be Accepted with Mismatched Email
* **Goal**: Verify that an invitation restricted to `family@elderlink.app` cannot be accepted by an attacker logged in as `intruder@elderlink.app`.
* **Execution**:
```sql
-- Step A: As Alice Owner, create invitation for Charlie Family
RESET ROLE;
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
SET ROLE authenticated;

SELECT public.create_care_invitation(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'family@elderlink.app',
  'family',
  168
);
-- Note the returned raw_invitation_code (e.g. 'abc...')

-- Step B: As Eve Intruder, attempt to accept Charlie's invitation
RESET ROLE;
SET request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
SET ROLE authenticated;

SELECT public.accept_care_invitation('<raw_code_from_step_A>');
```
* **Expected Result**: **FAIL** (`This invitation was issued for a different email address.`).

---

### Test 4: Replay Protection (Double-Acceptance Prevention)
* **Goal**: Verify that an invitation cannot be used twice.
* **Execution**:
```sql
-- Step A: Charlie accepts his legitimate invitation
RESET ROLE;
SET request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
SET ROLE authenticated;

SELECT public.accept_care_invitation('<raw_code_from_step_A>');
-- Success: Returns {"success": true, ...}

-- Step B: Attempt to reuse the same code
SELECT public.accept_care_invitation('<raw_code_from_step_A>');
```
* **Expected Result**: **FAIL** (`Invitation code is invalid, already used, or expired.`).

---

### Test 5: Rejection of Unattributed Medication Logs
* **Goal**: Verify that authenticated users cannot insert logs with `recorded_by = NULL`.
* **Execution**:
```sql
SET request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222'; -- Bob
SET ROLE authenticated;

INSERT INTO public.medication_logs (
  medication_id, schedule_id, elder_profile_id, scheduled_for, status, recorded_by
) VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  NOW(),
  'taken',
  NULL -- Attempting unattributed insertion
);
```
* **Expected Result**: **FAIL** (`new row violates row-level security policy for table "medication_logs"`). Must provide `recorded_by = auth.uid()`.

---

### Test 6: Caretaker Cannot Modify Another Caretaker's Log
* **Goal**: Verify that Bob cannot alter a medication log recorded by another user.
* **Execution**:
```sql
-- Step A: Insert log recorded by Alice Owner
RESET ROLE;
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
SET ROLE authenticated;

INSERT INTO public.medication_logs (
  id, medication_id, schedule_id, elder_profile_id, scheduled_for, status, recorded_by
) VALUES (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  NOW() - interval '1 hour',
  'taken',
  '11111111-1111-1111-1111-111111111111'
);

-- Step B: As Bob Caretaker, attempt to update Alice's log
RESET ROLE;
SET request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
SET ROLE authenticated;

UPDATE public.medication_logs
SET status = 'skipped', notes = 'Tampered by Bob'
WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
```
* **Expected Result**: **0 rows updated** (RLS UPDATE policy hides/protects rows recorded by other non-owners).

---

### Test 7: Immutability Violation (Cross-Elder Reassignment)
* **Goal**: Verify that records cannot be moved across elder profiles.
* **Execution**:
```sql
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111'; -- Alice
SET ROLE authenticated;

UPDATE public.medications
SET elder_profile_id = '99999999-9999-9999-9999-999999999999'
WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
```
* **Expected Result**: **FAIL** (`Immutability violation: Cannot reassign records across elder profiles.`).

---

### Test 8: Anonymous Direct Data Access Blocked
* **Goal**: Verify that unauthenticated requests cannot query private medical records.
* **Execution**:
```sql
RESET request.jwt.claim.sub;
SET ROLE anon;

SELECT * FROM public.medications;
SELECT * FROM public.elder_profiles;
SELECT * FROM public.care_circle_members;
```
* **Expected Result**: **FAIL** (`permission denied for relation ...` or empty set governed by RLS).

---

## Test Verification Summary

| # | Test Scenario | Threat Prevented | Target Result | Status |
| :- | :--- | :--- | :--- | :-: |
| 1 | Caretaker Direct Member Insert | Privilege Escalation to Owner Level | Rejected by RLS | Passed |
| 2 | Read `invitation_code_hash` | Raw Invitation Hash Discovery | Column Permission Denied | Passed |
| 3 | Mismatched Email Acceptance | Phishing / Invitation Interception | Exception in RPC | Passed |
| 4 | Duplicate Invitation Replay | Double Registration / Race Conditions | Exception in RPC | Passed |
| 5 | Unattributed Log Insert | Anonymous Clinical Data Corruption | Rejected by RLS | Passed |
| 6 | Caretaker Modifying Peer's Log | Audit Trail Tampering | 0 Rows Modified by RLS | Passed |
| 7 | Cross-Elder Record Reassignment | Data Leakage Across Care Circles | Exception via Trigger | Passed |
| 8 | Anonymous Table Access | Public Medical Record Exposure | Permission Denied | Passed |
