# Lab 3 Test Plan and Traceability

Status: Planned before implementation for Issue #33. Final paths/results must be updated from actual repository evidence; passing results must never be invented.

## 1. Test Strategy

Lab 3 uses Test DD and TDD across unit, API/integration, UI component, UI style, responsive/accessibility, security/authorization, migration/regression, and E2E levels. Main feature Issues should introduce or update the planned failing tests before/alongside implementation. Existing Lab 1/Lab 2 tests remain regression coverage unless an approved Lab 3 migration intentionally replaces a temporary Lab 2 behavior.

## 2. Planned Automated Tests

`Pending` means the test is planned by the Engineering Contract but has not yet been implemented/run for final Lab 3 evidence.

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-03, BR-32; AC-21, AC-22 | Email normalization/duplicate comparison | Trimmed lowercase uniqueness behavior | `server/tests/lab-03/auth.api.test.ts` or extracted unit helper test | Pending |
| UNIT-02 | Unit | BR-05, BR-06; AC-03, AC-21, AC-23 | Password validation + scrypt hash/verify | Boundaries enforced; plaintext never stored; valid verify succeeds | `server/tests/lab-03/auth.api.test.ts` | Pending |
| UNIT-03 | Unit | BR-23, BR-24; AC-15 | Ticket status transition helper | Only matrix transitions accepted | `server/tests/lab-03/staff-ticket-detail.api.test.ts` or extracted unit helper test | Pending |
| UNIT-04 | Unit | BR-30; AC-16 | Comment/note validation | Blank/over-limit rejected; valid plain text accepted | `server/tests/lab-03/comments-notes.api.test.ts` | Pending |
| MIG-01 | Migration/Regression | FR-24, BR-37; AC-07 | Lab 2 Requester -> User migration | Existing Ticket requester ids/Attachments remain valid | `server/tests/lab-03/authorization.api.test.ts` plus migration verification | Pending |
| MIG-02 | Migration/Regression | FR-25; AC-25 | Idempotent Lab 3 seed | Required active/inactive roles/data exist without duplicates | `server/tests/lab-03/users-admin.api.test.ts` or dedicated seed test if needed | Pending |
| API-01 | API | FR-01; AC-01 | Valid active login | 200; session established; safe User + CSRF returned | `server/tests/lab-03/auth.api.test.ts` | Pending |
| API-02 | API/Security | FR-01; AC-02 | Invalid credentials | 401 generic error; no secrets/profile leak | `server/tests/lab-03/auth.api.test.ts` | Pending |
| API-03 | API/Security | BR-01, BR-08; AC-02 | Inactive account login | 403 inactive safe error; no profile/secret data | `server/tests/lab-03/auth.api.test.ts` | Pending |
| API-04 | API/Security | BR-07; AC-02 | Login attempt throttle | 429 after approved threshold/window | `server/tests/lab-03/auth.api.test.ts` | Pending |
| API-05 | API | FR-02; AC-01, AC-05 | Current User | Safe current User/role/CSRF only | `server/tests/lab-03/auth.api.test.ts` | Pending |
| API-06 | API/Security | FR-04; AC-03 | First-password gate | Normal protected endpoint returns `PASSWORD_CHANGE_REQUIRED` | `server/tests/lab-03/auth.api.test.ts` | Pending |
| API-07 | API/Security | BR-05, BR-10; AC-03 | Change password | Valid change clears flag, rotates current session, revokes others | `server/tests/lab-03/auth.api.test.ts` | Pending |
| API-08 | API/Security | FR-03, BR-09, BR-10; AC-04 | Logout/expired session | Protected request rejected after logout/expiry | `server/tests/lab-03/auth.api.test.ts` | Pending |
| SEC-03 | API/Security | BR-10, AD-11; AC-01, AC-04 | Credentialed CORS / CSRF origin behavior | Approved frontend origin works with credentials; unapproved origin/state-changing CSRF request is rejected | `server/tests/lab-03/auth.api.test.ts` | Pending |
| API-09 | API/Security | FR-06, FR-07; AC-06 | Client-supplied requester identity attack | Authenticated Requester identity wins; no cross-user data | `server/tests/lab-03/authorization.api.test.ts` | Pending |
| API-10 | API/Security | BR-14; AC-06 | Cross-requester Ticket/Attachment access | Safe 404-equivalent; existence not leaked | `server/tests/lab-03/authorization.api.test.ts` | Pending |
| API-11 | API/Regression | FR-08; AC-08 | Authenticated Requester create/list/detail | Lab 2 core flows work without selector | `server/tests/lab-03/authorization.api.test.ts` + existing Lab 2 tests | Pending |
| API-12 | API/Regression | FR-08; AC-19 | Authenticated Attachment lifecycle | Existing upload/download/soft-remove rules remain | existing `server/tests/lab-02/attachments.api.test.ts` plus Lab 3 auth wrapper coverage | Pending |
| API-13 | API | FR-10, FR-16; AC-09 | Requester Public Comment | Stored with backend author/time; visible to permitted roles | `server/tests/lab-03/comments-notes.api.test.ts` | Pending |
| API-14 | API | FR-10, BR-21; AC-10 | Problem Appears Resolved | Indication recorded; status unchanged; repeat safe/idempotent | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pending |
| API-15 | API | FR-11; AC-11 | Staff Queue default/query behavior | Correct search/filter/sort/page data + metadata | `server/tests/lab-03/staff-queue.api.test.ts` | Pending |
| API-16 | API | FR-11; AC-11 | Queue invalid parameters | Unknown/invalid query returns 400 | `server/tests/lab-03/staff-queue.api.test.ts` | Pending |
| API-17 | API/Security | FR-11, FR-06; AC-11, AC-24 | Queue role authorization | Requester/Admin normal Queue denied; IT Staff allowed | `server/tests/lab-03/staff-queue.api.test.ts` | Pending |
| API-18 | API | FR-13, BR-16; AC-13 | Claim owner | Unassigned Ticket claimed by current active IT Staff | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pending |
| API-19 | API | FR-13, BR-16; AC-13 | Assign/reassign/unassign | Only active IT Staff/Admin target accepted; conflict safe | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pending |
| API-20 | API/Security | FR-14, BR-18, BR-19; AC-14 | IT Priority | IT Staff/Admin update allowed; Requested Priority unchanged; Requester forbidden | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pending |
| API-21 | API/Security | FR-15, BR-23; AC-15 | Status transitions | Valid IT Staff transition passes; invalid/Requester/Admin transition rejected | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pending |
| API-22 | API | FR-16, BR-30; AC-16 | Comment validation/render contract | Blank/over-limit rejected; markup stored as inert plain text | `server/tests/lab-03/comments-notes.api.test.ts` | Pending |
| API-23 | API/Security | FR-17, BR-27; AC-17 | Requester requests Internal Notes | 403; no note data/count/existence leak | `server/tests/lab-03/comments-notes.api.test.ts` | Pending |
| API-24 | API/Security | FR-17; AC-18 | Internal Note permitted roles | IT Staff creates/reads; Admin reads; Requester never receives notes | `server/tests/lab-03/comments-notes.api.test.ts` | Pending |
| API-25 | API/Regression | FR-12; AC-19 | Staff Detail Attachment continuity | Existing Attachment metadata/download rules remain protected | `server/tests/lab-03/staff-ticket-detail.api.test.ts` + Lab 2 attachment tests | Pending |
| API-26 | API | FR-18, FR-19; AC-20 | Admin list/search/role filter | Safe user rows; name/email search; optional role filter | `server/tests/lab-03/users-admin.api.test.ts` | Pending |
| API-27 | API | FR-20; AC-21 | Admin create User | One valid role; normalized unique email; hashed initial password; change flag true | `server/tests/lab-03/users-admin.api.test.ts` | Pending |
| API-28 | API/Security | FR-23; AC-22 | Duplicate email/invalid role/input | 400/409 safe rejection; no partial User | `server/tests/lab-03/users-admin.api.test.ts` | Pending |
| API-29 | API/Security | FR-21, FR-23; AC-22 | Self-deactivation / last active Admin | Conflict rejected atomically | `server/tests/lab-03/users-admin.api.test.ts` | Pending |
| API-30 | API/Security | FR-21, FR-22; AC-23 | Edit User/new initial password | Only allowed fields change; deactivation/role/password reset revokes target sessions; change flag true | `server/tests/lab-03/users-admin.api.test.ts` | Pending |
| API-31 | API/Security | FR-23; AC-24 | Non-Admin User Management | 403; no user list/account data | `server/tests/lab-03/users-admin.api.test.ts` | Pending |
| UI-01 | UI Component | FR-01; AC-01, AC-02, AC-26 | Login component | Validation, busy, valid/invalid/inactive/throttled/failure states | `client/tests/lab-03/Login.test.tsx` | Pending |
| UI-02 | UI Component | FR-04; AC-03, AC-26 | Change Password | Rules, confirmation, saving, failure, success continuation | `client/tests/lab-03/ChangePassword.test.tsx` | Pending |
| UI-03 | UI Component | FR-05; AC-05, AC-24 | Role navigation | Correct identity/role/nav; unauthorized nav absent | `client/tests/lab-03/Login.test.tsx` or shell-focused Lab 3 test | Pending |
| UI-04 | UI Component/Regression | FR-08, FR-09; AC-08 | Requester regression shell | No selector/Change Requester; authenticated identity shown | existing Requester tests updated for Lab 3 auth context | Pending |
| UI-05 | UI Component | FR-10; AC-09, AC-10 | Requester comments/resolution indication | Public composer/results + indication without status change UI | existing detail test or Lab 3 Requester regression test | Pending |
| UI-06 | UI Component | FR-11; AC-12, AC-26 | Staff Queue | Query controls, results, empty/no-results/forbidden/failure | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Pending |
| UI-07 | UI Component | FR-12-FR-17; AC-13-AC-19 | Staff Ticket Detail | Owner/priority/status/comments/notes/Attachments and feedback | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Pending |
| UI-08 | UI Component | FR-18-FR-23; AC-20-AC-24 | User Management | List/search/filter/create/edit/password/safety/forbidden states | `client/tests/lab-03/UserManagement.test.tsx` | Pending |
| STYLE-01 | UI Style | FR-26, FR-27; AC-26, AC-27 | Zen Green/auth/badge/read-only/editable styling | Required semantic classes/states remain consistent | Lab 3 style test under `client/tests/lab-03/` | Pending |
| SEC-01 | Security/API | FR-06; AC-06, AC-17, AC-24 | Direct API authorization matrix | Wrong role/owner cannot bypass UI | `server/tests/lab-03/authorization.api.test.ts` | Pending |
| SEC-02 | Security/API | BR-39; AC-02, AC-06, AC-17, AC-22 | Safe errors | No hash/token/path/protected existence leakage | Lab 3 API suites | Pending |
| RESP-01 | Responsive/E2E | FR-27; AC-27 | Desktop `>=992px` | No clipping/overlap/overflow; all actions reachable | Lab 3 E2E specs | Pending |
| RESP-02 | Responsive/E2E | FR-27; AC-27 | Tablet `768-991px` | Queue/list/detail/forms remain usable | Lab 3 E2E specs | Pending |
| RESP-03 | Responsive/E2E | FR-27; AC-27 | Mobile `<768px` | Cards/stacked fields; touch controls; no page overflow | Lab 3 E2E specs | Pending |
| A11Y-01 | Accessibility | FR-27; AC-27 | Keyboard/focus/names/non-color status | Major workflows keyboard-operable with visible focus | Lab 3 UI/E2E checks | Pending |
| E2E-01 | E2E | AC-01-AC-05 | Authentication flow | Login invalid/valid/inactive; mandatory change; role shell; logout; blocked direct access | `e2e/lab-03/authentication.spec.ts` | Pending |
| E2E-02 | E2E | AC-08-AC-19 | Staff/Requester Ticket flow | Requester regression + Queue -> Detail -> claim/priority/status/comment/note/Attachment | `e2e/lab-03/staff-ticket-flow.spec.ts` | Pending |
| E2E-03 | E2E | AC-20-AC-24 | Administrator flow | list/search/filter/create/edit/activation/new initial password/safety/forbidden | `e2e/lab-03/user-administration.spec.ts` | Pending |
| FULL-01 | Full regression | AC-28 | Server/client/Lab 1/Lab 2/Lab 3 suites | All required automated suites pass from final integrated state | repository test commands below | Pending |

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
| AC-08 | API-11, UI-04, E2E-02 |
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
| AC-28 | FULL-01 plus final runs of every required suite |

## 4. Required Lab 3 Test Files

Server minimum structure from the handout:

```text
server/tests/lab-03/
├── auth.api.test.ts
├── authorization.api.test.ts
├── staff-queue.api.test.ts
├── staff-ticket-detail.api.test.ts
├── comments-notes.api.test.ts
└── users-admin.api.test.ts
```

Client minimum structure:

```text
client/tests/lab-03/
├── Login.test.tsx
├── ChangePassword.test.tsx
├── StaffTicketQueue.test.tsx
├── StaffTicketDetail.test.tsx
└── UserManagement.test.tsx
```

Additional focused tests may be added when they make ownership/security/regression behavior clearer.

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

Final release verification may run `npx playwright test` when the complete integrated suite is ready.

## 7. Manual / Visual Verification

- Verify desktop/tablet/mobile major screens against `ui-spec.md` and screenshot structure.
- Verify visible keyboard focus and role-navigation differences.
- Verify Public Comments/Internal Notes are visually distinct.
- Verify editable/read-only styling, status/requested/IT priority/role badges, validation placement, clipping, overlap, and horizontal overflow.
- Verify protected direct URLs/API calls fail safely after logout and for wrong roles.

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

