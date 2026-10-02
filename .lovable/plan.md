# Batch 5 — Personas, Super Admin Access Fixes, Reports

Three coherent workstreams in one batch. Order matters: roles + RLS first, then UI, then reports.

---

## Part A — Persona / role model (Hybrid)

### New `app_role` enum values
Add only the truly new scopes:
- `certification_admin` — owns `certifications_catalog`, learning paths
- `lab_admin` — owns hands-on labs / sandboxes (new scope; we'll wire UI placeholders if no lab tables exist yet)
- `operations_admin` — owns notifications, reminders, reconciliation, system health

Fold "assessment_admin" into existing `content_admin` (same scope: mock exams, question bank, study resources). Keep existing `admin`, `content_admin`, `finance_admin`, `support_admin`, `learner`. Super Admin stays in the `super_admins` table — never in `user_roles`.

### Permissions matrix expansion
Add new permission keys to `role_permissions`:
- `certifications.manage`, `learning_paths.manage`
- `labs.manage`
- `assessments.manage` (mock exams + question bank)
- `reports.view`, `reports.export`
- `access_rules.manage`, `roles.audit.view`, `permissions.view`
- `reminders.manage`, `reconciliation.manage`

Default mapping (admin UI is then driven by these, not hard-coded role lists):

| Permission | super | admin | content | cert | lab | finance | ops | support |
|---|---|---|---|---|---|---|---|---|
| certifications.manage | ✓ | ✓ | ✓ | ✓ | | | | |
| assessments.manage | ✓ | ✓ | ✓ | | | | | |
| labs.manage | ✓ | ✓ | | | ✓ | | | |
| learning_paths.manage | ✓ | ✓ | ✓ | ✓ | | | | |
| reports.view | ✓ | ✓ | | | | ✓ | ✓ | ✓ |
| reports.export | ✓ | ✓ | | | | ✓ | | |
| access_rules.manage | ✓ | ✓ | | | | | ✓ | |
| roles.audit.view | ✓ | | | | | | | |
| permissions.view | ✓ | ✓ | | | | | ✓ | |
| reminders.manage | ✓ | ✓ | | | | | ✓ | |
| reconciliation.manage | ✓ | ✓ | | | | ✓ | | |

### RLS updates
Every table currently gated by `has_role(uid,'admin')` gets an extra `OR is_super_admin(auth.uid())` branch. Specifically: `access_rules`, `role_audit_log`, `role_permissions`, `super_admin_subscription`, `question_bank`, `mock_exams`, `certifications_catalog`, `study_resources`, `subscription_plans`, `admin_notifications`, `invoice_*`, `payments`, `ai_*`, `learner_*`. Add scope branches for `certification_admin` and `content_admin` where the table is theirs to read/write.

---

## Part B — Super Admin "access denied" fixes

Root cause sweep (the reported pages — Access Control, Role Audit Log, Permissions Matrix, My Plan):

1. **`access_rules`** — RLS policies only check `has_role('admin')`. Super Admin's RPC `is_super_admin` returns true but the table query still rejects. Add `OR public.is_super_admin(auth.uid())` to all four CRUD policies.
2. **`role_audit_log`** — same fix; policy checks `has_role('admin')` only.
3. **`role_permissions`** — same fix; SELECT must include super, UPDATE must include super.
4. **`super_admin_subscription`** — table exists but read policy may require admin role, not super. Fix.
5. **Server fns** — sweep `src/lib/admin.functions.ts`, `access-control.functions.ts`, and any `*.functions.ts` using `assertAdmin`/`has_role` to ensure the OR-super-admin branch is present everywhere it's missing (most already have it; will audit and standardize via a single `assertAdminOrSuper` helper).
6. **Admin nav** — `admin.tsx` sidebar uses hard-coded `roles: ["super"]` chips. Switch the nav permission filter to consult the new `role_permissions` matrix via `getMyAdminPermissions()` so adding/removing matrix entries reshapes the nav without code edits. Super Admin gets every permission implicitly.

---

## Part C — Reports & Analytics (`/admin/reports`)

Replace `AdminStub` with a real dashboard. Server fn `getAdminReports({ from, to, granularity })` returns:

- **Revenue & subscriptions**: MRR (sum of active monthly + yearly/12), active vs trialing counts by `plan_code`, churn (canceled this period), trial→paid conversion %, new subs in period.
- **Learner activity**: new signups, DAU/WAU/MAU from `profiles.last_seen_at` (add column if missing), mock exams taken (`mock_exam_results.created_at`), avg score, resource access events.
- **Per-org breakdown**: top 10 orgs by seats / mock exams.

UI: date-range picker (7d / 30d / 90d / custom), KPI cards, simple line/bar charts using existing `recharts`. Export-CSV button (gated by `reports.export`).

Also implement `/admin/subscribers` (still a stub): paginated table of `subscriptions` joined to user/org, status filter, "Open in Stripe portal" action reusing `createPortalSession`.

---

## Part D — Operational glitches sweep

- Audit every `*.functions.ts` for missing `is_super_admin` OR-branches.
- Audit every RLS policy referencing `has_role(..., 'admin')` to add `OR is_super_admin(auth.uid())`.
- Standardize on `assertAdminOrSuper(supabase, userId, requiredRoles?)` helper.
- Standardize sidebar/nav gating on `getMyAdminPermissions()` (driven by `role_permissions` + super-admin override).
- Fix the runtime preview error (`Failed to fetch dynamically imported module: virtual:tanstack-start-client-entry`) — usually a stale client chunk after route additions; will verify after migration lands.

---

## Technical sequencing (one migration, then code)

1. **Migration**
   - `ALTER TYPE app_role ADD VALUE` for `certification_admin`, `lab_admin`, `operations_admin`.
   - Seed `role_permissions` rows for new permission keys.
   - Rewrite RLS policies on the tables listed in Part B/A to include `OR is_super_admin(auth.uid())` and the new role branches.
   - Add `profiles.last_seen_at timestamptz` (+ touch on every authed server fn middleware, optional follow-up).

2. **Server code**
   - New helper `src/lib/admin-auth.server.ts`: `assertAdminOrSuper`, `hasAdminPermission`.
   - New `src/lib/admin-reports.functions.ts`: `getAdminReports`, `exportAdminReportsCsv`.
   - Refactor `admin.tsx` nav to consume permission map.
   - Update `admin-dashboard.functions.ts` to return permissions + flags.

3. **UI**
   - Real `/admin/reports` page.
   - Real `/admin/subscribers` page.
   - Verify Access Control, Role Audit Log, Permissions Matrix, My Plan all load for Super Admin.

4. **Verification**
   - Log in as Super Admin → every nav item opens without "Access denied".
   - Log in as a user with only `content_admin` → sees Certifications/Resources/Mock Exams/Question Bank/Learning Paths, hidden from Reports export, Permissions, etc.
   - Reports show non-zero MRR after one sandbox checkout.

---

## Out of scope (deferred to later batches)
- Lab admin UI (no labs feature exists yet — role + permission key only).
- Full per-permission editor UI for Super Admin (matrix UI already exists; we'll just light it up).
- Cohort retention, funnel charts beyond the v1 KPIs above.
- Reminder secret + email provider (still on the backlog from Batch 1/6).
- Enterprise lead-capture form (Batch 7).
- Stripe go-live (Batch ready when you verify in sandbox).

Reply **go** to switch to build mode.
