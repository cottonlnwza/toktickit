# Lab 3 Test Plan and Traceability

Status: Planned before implementation for Issue #33. Final paths/results must be updated from actual repository evidence; passing results must never be invented.

## 1. Test Strategy

Lab 3 uses Test DD and TDD across unit, API/integration, UI component, UI style, responsive/accessibility, security/authorization, migration/regression, and E2E levels. Main feature Issues should introduce or update the planned failing tests before/alongside implementation. Existing Lab 1/Lab 2 tests remain regression coverage unless an approved Lab 3 migration intentionally replaces a temporary Lab 2 behavior.

During Issue #35, the normal/default client entry switches to the authenticated Lab 3 shell while preserving the Lab 2 Requester workflows on the production Requester path. The shared Requester workflow accepts the authenticated User as a fixed Requester identity in production, so Create Ticket, My Tickets, Ticket Detail, and Attachment UI remain reachable without rendering/calling the Development Requester selector. `LegacyRequesterApp` remains only as a wrapper for the historical Lab 1/Lab 2 component tests. Issue #36 still owns the backend Requester ownership/authorization rewrite and final removal of client-supplied Requester identity from domain APIs.

### 1.1 Migration/seed database isolation

`migration.integration.test.ts` and `seed.integration.test.ts` must never reset, migrate, truncate, or seed the normal development `DATABASE_URL`. They run only against a dedicated PostgreSQL test database supplied through `TEST_DATABASE_URL` (planned local name: `toktickit_lab3_test`). The test harness must fail before any destructive setup if `TEST_DATABASE_URL` is missing, if it resolves to the same database as `DATABASE_URL`, or if the target database name does not end in `_test`.

Migration verification reconstructs a controlled Lab 2 baseline in that isolated database by applying the committed Lab 1/Lab 2 migration SQL in order, inserts controlled legacy Requester/Ticket/Attachment fixtures, captures preservation invariants, then applies the Lab 3 migration under test and verifies the post-migration contract. Seed verification runs only after the Lab 3 schema exists in the isolated test database, runs the Lab 3 seed at least twice, snapshots credential fields between runs, and verifies that reruns do not duplicate data or reset credentials. No migration/seed integration test may use the developer's existing TokTickIT database as its reset target.

## 2. Planned Automated Tests

`Pending` means the test is planned by the Engineering Contract but has not yet been implemented/run for final Lab 3 evidence.

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-06, BR-31; AC-21, AC-22 | Email normalization/duplicate comparison | Trimmed lowercase uniqueness behavior | `server/tests/lab-03/auth.unit.test.ts` | Pending |
| UNIT-02 | Unit | BR-08, BR-09; AC-03, AC-21, AC-23 | Password validation + scrypt hash/verify | Boundaries enforced; plaintext never stored; valid verify succeeds | `server/tests/lab-03/auth.unit.test.ts` | Pass — Issue #35 local / Node 22 |
| UNIT-03 | Unit | BR-24, BR-25; AC-15 | Ticket status transition helper | Only matrix transitions accepted | `server/tests/lab-03/ticket-status.unit.test.ts` | Pending |
| UNIT-04 | Unit | BR-29; AC-16 | Comment/note validation | Blank/over-limit rejected; valid plain text accepted | `server/tests/lab-03/comments-notes.unit.test.ts` | Pending |
| MIG-01 | Migration/Regression | FR-24, BR-36, BR-37, BR-38, BR-39; AC-07 | Lab 2 Requester -> User migration/provisioning | Exact legacy ids/FKs/data/counts/timestamps/Attachment metadata remain valid; normalized-email collision aborts before mutation; the absent Lab 2 `clientRequestId` column receives the deterministic UUID backfill before required/global-unique enforcement; FK/onDelete/index invariants match Section 7.1/7.2; first credential provisioning is hashed; rerun does not reset changed credentials; documented clean-database deployment reconciles Prisma migration history | `server/tests/lab-03/migration.integration.test.ts` | Pass — Issue #34 local isolated PostgreSQL / Node 22 |
| MIG-02 | Migration/Regression | FR-25, BR-37; AC-25 | Idempotent Lab 3 seed | Required active/inactive roles/data exist without duplicate Users, seeded Tickets, Public Comments, or Internal Notes; credential changes survive rerun | `server/tests/lab-03/seed.integration.test.ts` | Pass — Issue #34 local isolated PostgreSQL / Node 22 |
| API-01 | API | FR-01; AC-01 | Valid active login | 200; session established; safe User + CSRF returned | `server/tests/lab-03/auth.api.test.ts` | Pass — Issue #35 isolated PostgreSQL / Node 22 |
| API-02 | API/Security | FR-01; AC-02 | Invalid credentials | 401 generic error; no secrets/profile leak | `server/tests/lab-03/auth.api.test.ts` | Pass — Issue #35 isolated PostgreSQL / Node 22 |
| API-03 | API/Security | BR-01, BR-11; AC-02 | Inactive account login | 403 inactive safe error; no profile/secret data | `server/tests/lab-03/auth.api.test.ts` | Pass — Issue #35 isolated PostgreSQL / Node 22 |
| API-04 | API/Security | BR-10; AC-02 | Login attempt throttle | 429 after approved threshold/window; successful login does not erase failures still inside the 15-minute window | `server/tests/lab-03/auth.api.test.ts` | Pass — Issue #35 isolated PostgreSQL / Node 22 |
| API-05 | API | FR-02; AC-01, AC-05 | Current User | Safe current User/role/CSRF only | `server/tests/lab-03/auth.api.test.ts` | Pass — Issue #35 isolated PostgreSQL / Node 22 |
| API-06 | API/Security | FR-04; AC-03 | First-password gate | Exported production `GET /api/categories` returns `PASSWORD_CHANGE_REQUIRED` before the mandatory password change and succeeds after a valid change | `server/tests/lab-03/auth.api.test.ts` | Pass — Issue #35 isolated PostgreSQL / Node 22 |
| API-07 | API/Security | BR-08, BR-13; AC-03 | Change password | Valid change clears flag, rotates current session, revokes others; concurrent changes produce one logical winner whose credential/session remains valid while the loser cannot overwrite it | `server/tests/lab-03/auth.api.test.ts` | Pass — Issue #35 isolated PostgreSQL / Node 22 |
| API-08 | API/Security | FR-03, FR-06, BR-12, BR-13; AC-04 | Direct protected-domain access / logout / expired session | Current Requester/Ticket/Attachment domain routes reject unauthenticated direct access; a valid session reaches a real domain route; the same protected route is rejected after logout or session expiry | `server/tests/lab-03/auth.api.test.ts` | Pass — Issue #35 isolated PostgreSQL / Node 22 |
| SEC-03 | API/Security | BR-13, AD-13; AC-01, AC-04 | Credentialed CORS / CSRF origin behavior | Approved frontend origin works with credentials; unapproved origin/state-changing CSRF request is rejected | `server/tests/lab-03/auth.api.test.ts` | Pass — Issue #35 isolated PostgreSQL / Node 22 |
| API-09 | API/Security | FR-06, FR-07; AC-06 | Client-supplied requester identity attack | Authenticated Requester identity wins; no cross-user data | `server/tests/lab-03/authorization.api.test.ts` | Pass — Issue #36 isolated PostgreSQL / Node 22 |
| API-10 | API/Security | BR-16; AC-06 | Cross-requester Ticket/Attachment access | Safe 404-equivalent; existence not leaked | `server/tests/lab-03/authorization.api.test.ts` | Pass — Issue #36 isolated PostgreSQL / Node 22 |
| API-11 | API/Regression | FR-08; AC-08 | Authenticated Requester create/list/detail | Lab 2 core flows work without selector | `server/tests/lab-03/requester-regression.api.test.ts` | Pass — Issue #36 isolated PostgreSQL / Node 22 |
| API-12 | API/Regression | FR-08; AC-19 | Authenticated Attachment lifecycle | Existing upload/download/soft-remove rules and DTO names remain under authenticated ownership | `server/tests/lab-03/attachments-regression.api.test.ts` | Pass — Issue #36 isolated PostgreSQL / Node 22 |
| API-13 | API | FR-10, FR-16; AC-09 | Requester Public Comment | Stored with backend author/time; visible to permitted roles | `server/tests/lab-03/comments-notes.api.test.ts` | Pass — Issue #36 isolated PostgreSQL / Node 22 |
| API-14 | API | FR-10, BR-05, BR-42; AC-10 | Problem Appears Resolved | Only `OPEN`/`IN_PROGRESS`/`WAITING_FOR_REQUESTER`/`REOPENED` accept the indication; `NEW`/`RESOLVED`/`CLOSED`/`CANCELLED` return 409 without mutation; status remains unchanged; eligible repeats are idempotent; concurrency regression explicitly starts the Requester HTTP request while Staff still holds the row lock, verifies that it remains pending, then commits `OPEN -> RESOLVED` and expects 409 with no indication write | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass — Issue #36 isolated PostgreSQL / Node 22 |
| API-15 | API | FR-11, BR-18; AC-11 | Staff Queue default/query behavior | Correct search/filter/sort/page data plus stable active IT Staff/Administrator owner-filter metadata independent of current results | `server/tests/lab-03/staff-queue.api.test.ts` | Pass — Issue #37 isolated PostgreSQL / Node 22 |
| API-16 | API | FR-11; AC-11 | Queue invalid parameters | Unknown/invalid query returns 400 | `server/tests/lab-03/staff-queue.api.test.ts` | Pass — Issue #37 isolated PostgreSQL / Node 22 |
| API-17 | API/Security | FR-11, FR-06; AC-11, AC-24 | Queue role authorization | Requester/Admin normal Queue denied; IT Staff allowed | `server/tests/lab-03/staff-queue.api.test.ts` | Pass — Issue #37 isolated PostgreSQL / Node 22 |
| API-18 | API | FR-13, BR-18; AC-13 | Claim owner | Unassigned Ticket claimed by current active IT Staff | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pending |
| API-19 | API | FR-13, BR-18; AC-13 | Assign/reassign/unassign | Only active IT Staff/Admin target accepted; conflict safe | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pending |
| API-20 | API/Security | FR-14, BR-20, BR-21; AC-14 | IT Priority | IT Staff/Admin update allowed; Requested Priority unchanged; Requester forbidden | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pending |
| API-21 | API/Security | FR-15, BR-23, BR-24; AC-15 | Status transitions | Valid IT Staff transition passes; invalid/Requester/Admin transition rejected | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pending |
| API-22 | API | FR-16, BR-29; AC-16 | Comment validation/render contract | Blank/over-limit rejected; markup stored as inert plain text | `server/tests/lab-03/comments-notes.api.test.ts` | Pending |
| API-23 | API/Security | FR-17, BR-04; AC-17 | Requester requests Internal Notes | 403; no note data/count/existence leak | `server/tests/lab-03/comments-notes.api.test.ts` | Pass — Issue #36 isolated PostgreSQL / Node 22 |
| API-24 | API/Security | FR-17; AC-18 | Internal Note permitted roles | IT Staff creates/reads; Admin reads; Requester never receives notes | `server/tests/lab-03/comments-notes.api.test.ts` | Pending |
| API-25 | API/Regression | FR-12; AC-19 | Staff Detail Attachment continuity | Existing Attachment metadata/download rules remain protected | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pending |
| API-26 | API | FR-18, FR-19; AC-20 | Admin list/search/role filter | Safe user rows; name/email search; optional role filter | `server/tests/lab-03/users-admin.api.test.ts` | Pending |
| API-27 | API | FR-20; AC-21 | Admin create User | One valid role; normalized unique email; hashed initial password; change flag true | `server/tests/lab-03/users-admin.api.test.ts` | Pending |
| API-28 | API/Security | FR-23; AC-22 | Duplicate email/invalid role/input | 400/409 safe rejection; no partial User | `server/tests/lab-03/users-admin.api.test.ts` | Pending |
| API-29 | API/Security | FR-21, FR-23; AC-22 | Self-deactivation / last active Admin | Conflict rejected atomically | `server/tests/lab-03/users-admin.api.test.ts` | Pending |
| API-30 | API/Security | FR-21, FR-22; AC-23 | Edit User/new initial password | Only allowed fields change; deactivation/role/password reset revokes target sessions; change flag true | `server/tests/lab-03/users-admin.api.test.ts` | Pending |
| API-31 | API/Security | FR-23; AC-24 | Non-Admin User Management | 403; no user list/account data | `server/tests/lab-03/users-admin.api.test.ts` | Pending |
| API-32 | API/Regression | FR-08, BR-38; AC-08 | Ticket create idempotency / Lab 3 replay key | `clientRequestId` is required and globally unique for new Lab 3 creates; first UUID create is 201; identical same-owner replay returns original Ticket with 200; conflicting or cross-Requester reuse returns 409 without disclosure; only one Ticket row exists | `server/tests/lab-03/requester-regression.api.test.ts` | Pass — Issue #36 isolated PostgreSQL / Node 22 |
| UI-01 | UI Component | FR-01; AC-01, AC-02, AC-26 | Login component | Validation, busy, valid/invalid/inactive/throttled/failure states | `client/tests/lab-03/Login.test.tsx` | Pass — Issue #35 Vitest/jsdom / Node 22 |
| UI-02 | UI Component | FR-04; AC-03, AC-26 | Change Password | Rules, confirmation, saving, failure, success continuation | `client/tests/lab-03/ChangePassword.test.tsx` | Pass — Issue #35 Vitest/jsdom / Node 22 |
| UI-03 | UI Component | FR-05; AC-05, AC-24 | Role navigation | Correct identity/role/nav; unauthorized nav absent | `client/tests/lab-03/AppShell.test.tsx` | Pass — Issue #35 Vitest/jsdom / Node 22 |
| UI-04 | UI Component/Regression | FR-08, FR-09; AC-08 | Requester regression shell/create/list | No selector/Change Requester; authenticated identity shown; retry reuses one `clientRequestId` | `client/tests/lab-03/RequesterRegression.test.tsx` | Pass — Issue #36 Vitest/jsdom / Node 22 |
| UI-05 | UI Component | FR-10; AC-09, AC-10 | Requester comments/resolution indication | Public composer/results + indication without status change UI | `client/tests/lab-03/RequesterTicketDetail.test.tsx` | Pass — Issue #36 Vitest/jsdom / Node 22 |
| UI-06 | UI Component | FR-11, BR-18; AC-12, AC-26 | Staff Queue | Loading, query controls, stable owner choices even when an owner is absent from the current page, desktop table, smaller-screen cards, results, empty/no-results/forbidden/safe failure + Retry | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Pass — Issue #37 Vitest/jsdom / Node 22 |
| UI-07 | UI Component | FR-12-FR-17; AC-13-AC-19 | Staff Ticket Detail | Owner/priority/status/comments/notes/Attachments and feedback | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Pending |
| UI-08 | UI Component | FR-18-FR-23; AC-20-AC-24 | User Management | List/search/filter/create/edit/password/safety/forbidden states | `client/tests/lab-03/UserManagement.test.tsx` | Pending |
| STYLE-01 | UI Style | FR-26, FR-27; AC-26, AC-27 | Zen Green/auth/badge/read-only/editable styling | Required semantic classes/states remain consistent | `client/tests/lab-03/ui-style.test.tsx` | Pending |
| SEC-01 | Security/API | FR-06; AC-06, AC-17, AC-24 | Direct API authorization matrix | Wrong role/owner cannot bypass UI | `server/tests/lab-03/authorization.api.test.ts` | Pass — Issue #36 isolated PostgreSQL / Node 22 |
| SEC-02 | Security/API | BR-41; AC-02, AC-06, AC-17, AC-22 | Safe errors | No hash/token/path/protected existence leakage | `server/tests/lab-03/authorization.api.test.ts` | Pass — Issue #36 isolated PostgreSQL / Node 22 |
| RESP-01 | Responsive/E2E | FR-27; AC-27 | Desktop `>=992px` | Login/Change Password/shell, Requester Create Ticket, My Tickets, Requester Ticket Detail with Attachments/Public Comments, Staff Queue, Staff Detail, and User Management have no clipping/overlap/overflow and all required actions are reachable | `e2e/lab-03/authentication.spec.ts`; `e2e/lab-03/staff-ticket-flow.spec.ts`; `e2e/lab-03/user-administration.spec.ts` | Pending |
| RESP-02 | Responsive/E2E | FR-27; AC-27 | Tablet `768-991px` | The same major-screen set, including all three Requester screens and Attachment/Public Comment states, remains usable without hidden controls or page-level overflow | `e2e/lab-03/authentication.spec.ts`; `e2e/lab-03/staff-ticket-flow.spec.ts`; `e2e/lab-03/user-administration.spec.ts` | Pending |
| RESP-03 | Responsive/E2E | FR-27; AC-27 | Mobile `<768px` | The same major-screen set uses stacked/card layouts where specified; Requester Create/My Tickets/Detail, Attachments/Public Comments, Staff and Admin actions remain reachable with no page overflow | `e2e/lab-03/authentication.spec.ts`; `e2e/lab-03/staff-ticket-flow.spec.ts`; `e2e/lab-03/user-administration.spec.ts` | Pending |
| A11Y-01 | Accessibility | FR-27; AC-27 | Keyboard/focus/names/non-color status | Major workflows keyboard-operable with visible focus | `e2e/lab-03/authentication.spec.ts`; `e2e/lab-03/staff-ticket-flow.spec.ts`; `e2e/lab-03/user-administration.spec.ts` | Pending |
| E2E-01 | E2E | AC-01-AC-05 | Authentication flow | Login invalid/valid/inactive; mandatory change; role shell; logout; blocked direct access | `e2e/lab-03/authentication.spec.ts` | Pending |
| E2E-02 | E2E | AC-08-AC-19 | Staff/Requester Ticket flow | Requester regression + Queue -> Detail -> claim/priority/status/comment/note/Attachment | `e2e/lab-03/staff-ticket-flow.spec.ts` | Pending |
| E2E-03 | E2E | AC-20-AC-24 | Administrator flow | list/search/filter/create/edit/activation/new initial password/safety/forbidden | `e2e/lab-03/user-administration.spec.ts` | Pending |
| REG-01 | Regression/API | FR-24; AC-28 | Lab 1/Lab 2 server regression under Lab 3 schema/auth changes | Required legacy reference/Ticket/Attachment behavior that remains in scope still passes | `server/tests/lab-03/regression.api.test.ts` | Pending |
| REG-02 | Regression/UI | FR-08; AC-28 | Lab 2 Requester UI regression under authenticated identity | Create/List/Detail/Attachment behavior remains usable after selector removal | `client/tests/lab-03/regression-ui.test.tsx` | Pending |

## 3. AC-to-Test Traceability

| AC | Planned tests |
|---|---|
| AC-01 | API-01, API-05, SEC-03, UI-01, E2E-01 |
| AC-02 | API-02, API-03, API-04, UI-01, SEC-02, E2E-01 |
| AC-03 | API-06, API-07, UI-02, E2E-01 |
| AC-04 | API-08, SEC-03, E2E-01 |
| AC-05 | API-05, UI-03, E2E-01 |
| AC-06 | API-09, API-10, SEC-01, SEC-02 |
| AC-07 | MIG-01 |
| AC-08 | API-11, API-32, UI-04, E2E-02 |
| AC-09 | API-13, UI-05, E2E-02 |
| AC-10 | API-14, UI-05, E2E-02 |
| AC-11 | API-15, API-16, API-17, E2E-02 |
| AC-12 | UI-06, RESP-01, RESP-02, RESP-03, E2E-02 |
| AC-13 | API-18, API-19, UI-07, E2E-02 |
| AC-14 | API-20, UI-07, E2E-02 |
| AC-15 | UNIT-03, API-21, UI-07, E2E-02 |
| AC-16 | UNIT-04, API-22, UI-07 |
| AC-17 | API-23, SEC-01, SEC-02 |
| AC-18 | API-24, UI-07, E2E-02 |
| AC-19 | API-12, API-25, UI-07, E2E-02 |
| AC-20 | API-26, UI-08, E2E-03 |
| AC-21 | UNIT-01, UNIT-02, API-27, UI-08, E2E-03 |
| AC-22 | UNIT-01, API-28, API-29, UI-08, SEC-02, E2E-03 |
| AC-23 | API-30, UI-08, E2E-03 |
| AC-24 | API-17, API-31, UI-03, UI-08, SEC-01, E2E-03 |
| AC-25 | MIG-02 |
| AC-26 | UI-01, UI-02, UI-06, UI-07, UI-08, STYLE-01 |
| AC-27 | STYLE-01, RESP-01, RESP-02, RESP-03, A11Y-01 |
| AC-28 | REG-01, REG-02 plus final runs of every explicitly listed Lab 3 test file and the release commands in Section 6 |

## 4. Required Lab 3 Test Files

Server handout-required files plus the focused files fixed by this Test DD contract:

```text
server/tests/lab-03/
├── auth.unit.test.ts
├── auth.api.test.ts
├── authorization.api.test.ts
├── migration.integration.test.ts
├── seed.integration.test.ts
├── ticket-status.unit.test.ts
├── comments-notes.unit.test.ts
├── requester-regression.api.test.ts
├── attachments-regression.api.test.ts
├── regression.api.test.ts
├── staff-queue.api.test.ts
├── staff-ticket-detail.api.test.ts
├── comments-notes.api.test.ts
└── users-admin.api.test.ts
```

Client handout-required files plus the focused files fixed by this Test DD contract:

```text
client/tests/lab-03/
├── Login.test.tsx
├── ChangePassword.test.tsx
├── AppShell.test.tsx
├── RequesterRegression.test.tsx
├── RequesterTicketDetail.test.tsx
├── regression-ui.test.tsx
├── ui-style.test.tsx
├── StaffTicketQueue.test.tsx
├── StaffTicketDetail.test.tsx
└── UserManagement.test.tsx
```

These paths are the planned targets for the Test IDs in Section 2. If implementation later needs to move or split one of them, the contract must be amended through review before treating the replacement path as evidence.

Required E2E structure:

```text
e2e/lab-03/
├── authentication.spec.ts
├── staff-ticket-flow.spec.ts
└── user-administration.spec.ts
```

## 5. TDD Order by Feature Issue

1. **Migration/seed:** add migration/regression/seed expectations first; observe expected failure; implement migration/seed; rerun Lab 2 regression.
2. **Authentication:** write `auth.api.test.ts`, Login, and ChangePassword expectations before/alongside auth implementation.
3. **Authorization/Requester regression:** add direct authorization/cross-owner tests before removing temporary requester identity behavior.
4. **Staff Queue:** add queue API/UI query/state tests before Queue implementation.
5. **Staff Detail:** add owner/priority/status/comment/note/Attachment tests before operational implementation.
6. **User Management:** add Admin list/create/edit/safety/forbidden tests before implementation.
7. **E2E/visual:** complete required E2E and responsive/accessibility evidence only after integrated feature behavior exists; do not change contract silently to make E2E pass.

## 6. Planned Commands

Use Node 22 for the project baseline because the verified Lab 2 client suite passes under Node 22.

```bash
npm test --prefix server
npm test --prefix client
npm run build --prefix server
npm run build --prefix client
npx playwright test e2e/lab-03/authentication.spec.ts
npx playwright test e2e/lab-03/staff-ticket-flow.spec.ts
npx playwright test e2e/lab-03/user-administration.spec.ts
```

### Issue #34 execution evidence

The Issue #34 migration/seed implementation was verified locally with Node `22.22.2` using isolated PostgreSQL databases only. `TEST_DATABASE_URL` targeted `toktickit_lab3_test`; the broader regression run used a separate `toktickit_lab3_suite_test`, so neither destructive migration setup nor seed tests targeted the normal development database.

- `npm run test:lab3:migration --prefix server`: 2 files / 8 tests passed after the PR #45 review corrections.
- `npm test --prefix server`: 13 files / 57 tests passed with the isolated suite/test databases on the final Issue #34 implementation.
- `npm test --prefix client`: 8 files / 45 tests passed.
- `npm run build --prefix server`: passed.
- `npm run build --prefix client`: passed.
- `prisma validate`: passed for the Lab 3 schema.
- Read-only check after testing confirmed the normal development database was still on the untouched Lab 2 schema with 5 Requesters, 99 Tickets, and 91 Attachments.

### Issue #35 execution evidence

Issue #35 Authentication Foundation followed TDD: `auth.api.test.ts`, `Login.test.tsx`, `ChangePassword.test.tsx`, and `AppShell.test.tsx` were added first and failed because the authentication routes/session middleware/UI did not yet exist. The implementation was then added without moving Requester ownership/domain authorization from Issue #36 into this Issue.

The reusable authenticated/normal-access middleware is implemented and, after PR #46 review feedback, it is wired to the exported production `GET /api/categories` normal application route. API-06 now logs in through the production app with `mustChangePassword=true`, verifies that this real route returns `403 PASSWORD_CHANGE_REQUIRED`, performs the production password-change flow, and verifies that the same route succeeds afterward. Issue #36 still owns Requester identity/role/ownership conversion for Ticket/Attachment domain APIs and is intentionally not pulled into this correction.

- Auth-focused server tests: `auth.unit.test.ts` + `auth.api.test.ts` = 2 files / 26 tests passed.
- Auth/production-continuity client tests: `Login.test.tsx` + `ChangePassword.test.tsx` + `AppShell.test.tsx` + `RequesterProductionContinuity.test.tsx` = 4 files / 22 tests passed.
- Full server regression suite: 14 files / 76 tests passed using `toktickit_lab3_suite_test` plus the separate migration/seed `TEST_DATABASE_URL`.
- Full client regression suite: 12 files / 67 tests passed. Existing Lab 1/Lab 2 component regression tests still run through the `LegacyRequesterApp` wrapper while the normal production Requester path uses the same underlying workflow with the authenticated User fixed as the Requester.
- `npm run build --prefix server`: passed.
- `npm run build --prefix client`: passed.
- `prisma validate`: passed.
- `git diff --check`: passed.
- Production-path component coverage verifies that an authenticated Requester renders Create Ticket immediately, can navigate to My Tickets and Ticket Detail, can see/use Attachment controls, never calls `GET /api/requesters`, never renders `Select Development Requester`/`Change Requester`, and does not use the Lab 2 `toktickit.devRequesterId` localStorage key. `GET /api/categories` is called credentialed because it is already a production protected route in Issue #35.

Issue #35 authentication verification covers safe active/invalid/inactive login, normalized-email login, five-failure window-based throttle behavior that is not reset by a successful login, opaque `HttpOnly` session cookie handling, server-side SHA-256 session/CSRF hashes, eight-hour absolute expiry, current-role/activation re-check, CSRF/origin rejection, mandatory first-password gating, direct unauthenticated protection for every currently exported Requester/Ticket/Attachment domain route, rejection of the same protected domain route after logout/expiry, password change/session rotation, optimistic concurrency protection for simultaneous password changes, other-session revocation, safe Login/Change Password UI states, and role-specific authenticated shell navigation.

The older Lab 2 API unit-style files that mock Prisma also mock only `requireNormalAccess` so they can continue isolating their historical validation/query/DTO behavior. Authentication is not inferred from those mocks: the exported production `app` authentication boundary is verified separately in `auth.api.test.ts`, while the database-backed Lab 2 Create Ticket regression suite authenticates a real session before calling its now-protected routes.

### Issue #36 execution evidence

Issue #36 Authorization and Requester Regression followed TDD. The planned authorization/requester/attachment/comment/resolution tests were added first and produced a legitimate red state against the Issue #35 baseline because canonical authenticated Requester APIs, ownership enforcement, Public Comments, and Problem Appears Resolved did not yet exist. The implementation then converted the production Requester path to authenticated identity while preserving the Lab 2 Requester workflows.

- Issue #36 focused server tests: `authorization.api.test.ts`, `requester-regression.api.test.ts`, `attachments-regression.api.test.ts`, `comments-notes.api.test.ts`, and the Requester resolution cases in `staff-ticket-detail.api.test.ts` = 5 files / 34 tests passed after the PR #47 lifecycle/race corrections.
- Issue #36 focused client tests: `RequesterRegression.test.tsx` + `RequesterTicketDetail.test.tsx` = 2 files / 4 tests passed after adding ineligible-state UI coverage.
- Full server regression suite: 19 files / 110 tests passed using `toktickit_lab3_suite_test` plus the separate migration/seed `TEST_DATABASE_URL`.
- Full client regression suite: 14 files / 71 tests passed.
- `npm run build --prefix server`: passed.
- `npm run build --prefix client`: passed.
- `prisma validate`: passed.
- `git diff --check`: passed.

Issue #36 verification covers authenticated Requester Ticket creation without a client-supplied Requester identity, required UUID replay/idempotency behavior, canonical `/api/tickets/mine` and owned Ticket Detail, safe cross-owner Ticket/Attachment 404 behavior, canonical Attachment metadata/upload/download/soft-remove behavior, Requester Public Comments with backend author/time, Requester denial from Internal Notes, lifecycle-gated/idempotent and race-safe Problem Appears Resolved without formal status mutation, wrong-role denial on Requester-only APIs, production UI removal of the Development Requester selector, retry reuse of one `clientRequestId`, and Requester Ticket Detail Public Comment/resolution controls without staff-only status/Internal Note controls.

### Issue #37 execution evidence

Issue #37 IT Staff Ticket Queue followed TDD. `staff-queue.api.test.ts` and `StaffTicketQueue.test.tsx` were created first and produced a legitimate red state against the merged Issue #36 baseline: the production server returned `404` for `/api/staff/tickets`, and the IT Staff shell still rendered only the authenticated-session placeholder instead of the Queue screen. The implementation then added only the approved Queue API/UI scope; Staff Ticket Detail operations remain deferred to Issue #38.

All Issue #37 verification counts below are **local verification only**. No hosted GitHub workflow/status result is claimed for PR #48 or the PR #49 follow-up. The PR #49 evidence clarification was added after review `5252287258` requested that local runs not be presented as hosted CI evidence.

- Issue #37 focused server: `staff-queue.api.test.ts` = 1 file / 23 tests passed.
- Issue #37 focused client: `StaffTicketQueue.test.tsx` = 1 file / 8 tests passed after the PR #48 owner-filter correction. Post-merge verification exposed a test-only async synchronization race in the off-page-owner assertion; the correction now awaits the owner option with Testing Library's async query. That exact test passed 5 consecutive isolated runs, the full `StaffTicketQueue.test.tsx` file passed, and the full client suite passed 3 consecutive runs (15 files / 79 tests each).
- Full server regression suite: 20 files / 133 tests passed using `toktickit_lab3_suite_test` plus the separate migration/seed `TEST_DATABASE_URL`.
- Full client regression suite: 15 files / 79 tests passed.
- `npm run build --prefix server`: passed.
- `npm run build --prefix client`: passed.
- `prisma validate`: passed.
- `git diff --check`: passed.

Issue #37 verification covers IT-Staff-only Queue authorization, unauthenticated rejection, safe `400 INVALID_QUERY` handling for unknown/invalid query parameters, shared search across Ticket Number/Summary/Requester Name/Email, Status/Requested Priority/IT Priority/Owner/Category/Related System filters, stable active IT Staff/Administrator owner choices independent of the current filtered/paged Ticket result, explicit unassigned ownership, documented sort/order/page/page-size behavior with deterministic `id desc` tie-break, safe Queue DTOs, assigned/unassigned presentation, loading/empty/no-results/forbidden/safe-failure states, Retry, desktop table fields, smaller-screen card representation hooks, and the Open-detail navigation action without implementing Issue #38 Ticket Detail operations.

Final release verification may run `npx playwright test` when the complete integrated suite is ready.

## 7. Manual / Visual Verification

- Verify desktop/tablet/mobile major screens against `ui-spec.md` and screenshot structure. The required screen set is explicit: Login/Change Password/authenticated shell, Requester Create Ticket, Requester My Tickets, Requester Ticket Detail with Attachment/Public Comment/Problem Appears Resolved states, IT Staff Queue, IT Staff Ticket Detail, and Administrator User Management.
- Verify visible keyboard focus and role-navigation differences.
- Verify Public Comments/Internal Notes are visually distinct.
- Verify editable/read-only styling, status/requested/IT priority/role badges, validation placement, clipping, overlap, and horizontal overflow.
- Verify protected direct URLs/API calls fail safely after logout and for wrong roles.

Part 9 screenshot traceability uses the following fixed folders from `ui-spec.md`: `authentication/`, `requester-create-ticket/`, `requester-my-tickets/`, `requester-ticket-detail/`, `staff-queue/`, `staff-ticket-detail/`, and `user-management/`. Each folder must contain the exact base evidence filenames `desktop.png`, `tablet.png`, and `mobile.png` before final release evidence is marked complete. For Requester coverage, the Create Ticket captures must include Attachment controls, My Tickets captures must show the list/query layout, and Requester Ticket Detail captures must include Attachment, Public Comment, and Problem Appears Resolved presentation; state-specific supporting screenshots may be additional files rather than substitutes for the three breakpoint files.

## 8. Final Results Log

Do not populate Pass values until commands actually run on the relevant integrated branch.

| Command / Evidence | Branch / Commit | Final result | Notes |
|---|---|---|---|
| Server tests | Pending | Pending | |
| Client tests | Pending | Pending | |
| Server build | Pending | Pending | |
| Client build | Pending | Pending | |
| Authentication E2E | Pending | Pending | |
| Staff Ticket E2E | Pending | Pending | |
| User Administration E2E | Pending | Pending | |
| Desktop/tablet/mobile visual checklist | Pending | Pending | |
