# Lab 4 — Test Plan and Evidence

All Lab 4 automated tests live under `server/tests/lab-04/`, `client/tests/lab-04/`, and `e2e/lab-04/`. Existing `lab-01`, `lab-02`, and `lab-03` tests remain regression evidence; no historical Lab 1–3 documentation is changed for this Lab 4 report.

| # | Tool | Test | Result |
|---|------|------|--------|
| 1 | Vitest / Supertest / Prisma | Actions Taken, Ticket lifecycle, authorization, dashboards, migrations/seed and performance smoke | Passed in recorded Issue #64–#68 runs |
| 2 | Vitest / React Testing Library | Actions Taken UI, workflow, dashboards, responsive structure and accessibility | Passed — 8 Lab 4 files / 19 tests in Issue #69 verification |
| 3 | Playwright (Chromium) | Actions, resolution gate, dashboards, isolation, conflicts, focus and visual checks | Passed — 11/11 on each desktop, tablet and mobile project in Issue #69 verification |
| 4 | Regression suites | Existing Labs 1–3 server/client/browser behavior under the Lab 4 contract | Passed in recorded Issue #68 runs; see detailed evidence below |
| 5 | TypeScript / Vite | Server and client production builds | Passed in Issue #69 verification |

## Test Files and Coverage

### Server

- `server/tests/lab-04/` covers Actions Taken business rules, authorization, idempotency, atomic Ticket/Action versions, workflow gates, dashboards, audit events, migration, seed and performance smoke.
- `server/tests/lab-01/`, `server/tests/lab-02/`, `server/tests/lab-03/` provide regression coverage. Migration/seed integration tests require an **isolated** PostgreSQL `_test` database.

### Client

- `client/tests/lab-04/` covers Actions Taken, Ticket workflow, Ticket version chaining, Requester/Staff dashboards, UI style, responsive structure and accessibility.
- `client/tests/lab-01/`, `client/tests/lab-02/`, `client/tests/lab-03/` provide UI regression evidence.

### End-to-end

- `e2e/lab-04/` covers authenticated Actions Taken, Ticket resolution/reopen, dashboard isolation/drill-down, failure/conflict behavior, and actual visual screenshots at desktop, tablet, and mobile sizes.
- Existing `e2e/lab-03/` verifies inherited full-product behavior under the Lab 4 schema.

### Detailed Lab 4 Test Matrix

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-12-BR-16 / AC-05, AC-06 | Action lifecycle + assignee completion rule | Only approved transitions; only current assignee may complete | `server/tests/lab-04/actions-taken.unit.test.ts` | Pass (Issue #64) |
| UNIT-02 | Unit | BR-06-BR-09 / AC-06, AC-07 | Action text/follow-up validation | Deterministic required/length/null behavior | `server/tests/lab-04/actions-taken.unit.test.ts` | Pass (Issue #64) |
| UNIT-03 | Unit | BR-24-BR-27 / AC-08-AC-10 | Cycle-aware Ticket resolution helper | Current cycle requires >=1 completed and zero active Actions; reopen increments cycle | `server/tests/lab-04/ticket-workflow.unit.test.ts` | Pass (Issue #66) |
| UNIT-04 | Unit | BR-28-BR-41 / AC-11, AC-12 | Dashboard calculations/boundaries | UTC snapshot, inclusive 7/30-day cutoffs, active-status enum sets | `server/tests/lab-04/dashboard.unit.test.ts` | Pass (Issue #67) |
| UNIT-05 | Unit | BR-18 / AC-02 | Immutable create fingerprint | Later Action edit does not alter replay fingerprint | `server/tests/lab-04/actions-taken.unit.test.ts` | Pass (Issue #64) |
| API-01 | API | FR-01-FR-06 / AC-01 | Create valid current-cycle Action | 201; creator/cycle/create time/version/event persisted; Ticket version increments | `server/tests/lab-04/actions-taken.api.test.ts` | Pass (Issue #64) |
| API-02 | API | BR-18 / AC-02 | Global UUID retry semantics | Exact original-intent replay after edit returns original without new versions/event; conflicting reuse 409 | `server/tests/lab-04/actions-taken.api.test.ts` | Pass (Issue #64) |
| API-03 | Authorization | FR-07 / AC-03 | Requester Action visibility/write restriction | Owned Actions across cycles readable; writes forbidden | `server/tests/lab-04/actions-taken.api.test.ts` | Pass (Issue #64) |
| API-04 | API | BR-10, BR-11 / AC-01, AC-04 | Assignee validation | Active IT Staff/Admin accepted; inactive/Requester rejected `409 INACTIVE_ASSIGNEE` | `server/tests/lab-04/actions-taken.api.test.ts` | Pass (Issue #64) |
| API-05 | Concurrency/API | BR-42-BR-44 / AC-04, AC-15 | Edit with parent+child CAS | Both revisions must match; stale parent or Action causes 409 and zero partial writes | `server/tests/lab-04/actions-taken.api.test.ts` | Pass (Issue #64) |
| API-06 | Workflow/API | BR-13 / AC-05 | Action transitions | PLANNED -> IN_PROGRESS/COMPLETED/CANCELLED and IN_PROGRESS -> COMPLETED/CANCELLED succeed; disallowed state edge returns 409 | `server/tests/lab-04/actions-taken.api.test.ts` | Pass (Issue #64) |
| API-06A | Workflow/API | BR-14 / AC-04, AC-05 | Terminal Action mutation guard | Edit and status mutation attempts on COMPLETED/CANCELLED Actions return 409 ACTION_TERMINAL with no rewrite | `server/tests/lab-04/actions-taken.api.test.ts` | Pass (Issue #77 hardening) |
| API-07 | Workflow/API | BR-15 / AC-06 | Assignee-only completion | Current assignee may complete from PLANNED or IN_PROGRESS; non-assignee gets 409 until reassigned; performer=assignee | `server/tests/lab-04/actions-taken.api.test.ts` | Pass (Issue #64) |
| API-08 | Validation/API | BR-07, BR-08, BR-44 / AC-06, AC-07 | Completion/follow-up validation taxonomy | Missing Result/follow-up Note => deterministic 400 VALIDATION_ERROR | `server/tests/lab-04/actions-taken.api.test.ts` | Pass (Issue #64) |
| API-09 | Workflow/API | BR-04 / AC-01, AC-04 | Parent Ticket eligibility | Action create/edit/status blocked with `409 PARENT_TICKET_NOT_ACTIVE` on terminal parent | `server/tests/lab-04/actions-taken.api.test.ts` | Pass (Issue #64) |
| API-10 | Audit/API | BR-19 / AC-18 | Append-only Action events | Exactly one event per successful create/edit/reassign/start/complete/cancel with actor/revisions | `server/tests/lab-04/actions-taken.api.test.ts` | Pass (Issue #64) |
| API-10A | Audit/API | BR-19 / AC-18 | Event invariants and failed mutation behavior | Event order/version uniqueness deterministic; combined edit+reassign emits one UPDATED event; replay/stale/failed mutations append none | `server/tests/lab-04/actions-taken.api.test.ts` | Pass (Issue #64) |
| API-10B | Authorization/Idempotency | BR-18, BR-44 / AC-02, AC-03 | Protected UUID reuse | UUID collision under a different Ticket resource returns safe 404; authorized same-Ticket fingerprint mismatch returns 409 | `server/tests/lab-04/actions-taken.api.test.ts` | Pass (Issue #64 review fix) |
| API-11 | Authorization | FR-16 / AC-03, AC-13 | Direct role authorization | Requester cannot mutate; Admin has Lab 4 staff behavior; protected data not leaked | `server/tests/lab-04/actions-taken.api.test.ts` | Pass (Issue #64) |
| API-12 | Workflow/API | BR-25 / AC-08 | Resolve without completed current-cycle evidence | Zero Actions/cancelled-only => 409 RESOLUTION_GATE_BLOCKED | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass (Issue #66) |
| API-13 | Workflow/API | BR-25 / AC-08 | Resolve with active current-cycle Action | Any PLANNED/IN_PROGRESS => 409; no Ticket mutation | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass (Issue #66) |
| API-14 | Workflow/API | BR-25 / AC-09 | Resolve with valid completed evidence | >=1 COMPLETED and no active current-cycle Action succeeds, sets resolvedAt | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass (Issue #66) |
| API-14A | Workflow/API | BR-08, BR-25 / AC-07, AC-09 | Follow-up metadata vs resolution gate | Completed Action with followUpRequired=true does not block by metadata alone; separate non-terminal follow-up Action does block | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass (Issue #66) |
| API-15 | Workflow/API | BR-24 / AC-10 | Reopen workflow cycle | REOPENED increments cycle; old Actions remain history and cannot satisfy new resolution | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass (Issue #66) |
| API-16 | Workflow/API | BR-21-BR-23 / AC-09, AC-13 | Final Ticket matrix + Admin parity | IT Staff/Admin same Lab 4 final transition authority; invalid state edge deterministic 409 | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass (Issue #66; all 20 permitted edges + Admin parity) |
| API-17 | Regression/API | BR-26 / AC-08, AC-09 | Requester appears-resolved | Advisory only; never changes formal status/gate | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass (Issue #66 focused regression: 9 tests) |
| API-18 | Concurrency/API | BR-42-BR-44 / AC-15 | Aggregate stale Ticket workflow | Stale expectedTicketVersion => 409, no status/cycle change | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass (Issue #66) |
| API-18A | Concurrency/API | BR-42-BR-44 / AC-15 | Owner/claim/IT Priority aggregate revision | Fresh mutation increments Ticket version once; stale revision returns 409 with no partial owner/priority/version write | `server/tests/lab-04/ticket-aggregate-version.api.test.ts` | Pass (Issue #76 hardening) |
| API-19 | Dashboard/API | BR-29-BR-32 / AC-11 | Requester dashboard ownership + exact windows | Owned only; inclusive UTC cutoffs; stable bounded recent lists; zero/empty explicit | `server/tests/lab-04/requester-dashboard.api.test.ts` | Pass (Issue #67) |
| API-19A | Dashboard/API | BR-31-BR-32 / AC-11 | Exact time-window boundaries | Exact lower bound included, exact generatedAt captured, future timestamp excluded | `server/tests/lab-04/requester-dashboard.api.test.ts` | Pass (Issue #67) |
| API-20 | Dashboard/API | BR-33-BR-39 / AC-12 | Staff dashboard current-work scope | Active-parent/current-cycle Actions only; historical/terminal-parent Actions excluded; selected counts checked against direct DB queries | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pass (Issue #67) |
| API-20A | Dashboard/API | BR-38-BR-39 / AC-12 | Current-user Action predicate | myOpenActions=current assignee only; myRecentActions=current assignee OR performer; creator-only Action excluded | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pass (Issue #67) |
| API-21 | Authorization | BR-40 / AC-13 | Administrator staff-dashboard reuse | Admin allowed with same metric semantics; Requester forbidden | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pass (Issue #67) |
| API-22 | Dashboard/API | BR-41 / AC-14 | Drill-down metadata/query intent | Response metadata and UI links map to owned My Tickets, filtered Ticket Queue, Action anchor, and Ticket Detail destinations | `server/tests/lab-04/requester-dashboard.api.test.ts`; `server/tests/lab-04/staff-dashboard.api.test.ts`; dashboard UI tests | Pass (Issue #67) |
| MIG-01 | Migration/Integration | FR-18 / AC-16 | Lab 3-shaped DB preservation | Earlier rows/relationships survive; new schema valid | `server/tests/lab-04/migration.integration.test.ts` | Pass (Issue #64) |
| MIG-02 | Migration/Integration | Data 8.4 / AC-16 | Ticket backfill/cycle legacy semantics | version=0; cycle=1; resolvedAt approximation; no-Action legacy rows preserved | `server/tests/lab-04/migration.integration.test.ts` | Pass (Issue #64) |
| SEED-01 | Integration | FR-19 / AC-17 | Seed idempotency/coverage | Re-run no duplicates; multi-cycle Actions/events/dashboard inclusion-exclusion fixtures exist | `server/tests/lab-04/seed.integration.test.ts` | Pass (Issue #64) |
| UI-01 | UI Component | FR-02-FR-07 / AC-01, AC-03-AC-07 | Actions UI | Cycle label, assignee accountability, create/edit/reassign/start/complete/cancel and deterministic errors | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass (Issue #65) |
| UI-01A | UI Component | BR-04, BR-14 / AC-04, AC-05, AC-10 | Terminal/historical Action read-only guard | COMPLETED/CANCELLED/historical-cycle Actions expose no mutation controls; successful complete/cancel immediately rerenders read-only | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass (Issue #77 hardening) |
| UI-02 | UI Component | FR-12 / AC-11, AC-14 | Requester Dashboard | Owned metrics/recent cards, empty state, role navigation, drill-down | `client/tests/lab-04/RequesterDashboard.test.tsx` | Pass (Issue #67) |
| UI-03 | UI Component | FR-13, FR-14 / AC-12-AC-14 | Staff/Admin Dashboard | Current-work metrics, Admin reuse, empty state, role navigation, drill-down | `client/tests/lab-04/StaffDashboard.test.tsx` | Pass (Issue #67) |
| UI-04 | UI Component | FR-09-FR-11 / AC-08-AC-10, AC-13, AC-15 | Ticket workflow controls | Current-cycle gate, Admin parity, reopen cycle, stale feedback | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass (Issue #66: 3 tests) |
| UI-04A | UI Component | BR-42-BR-44 / AC-15 | Owner/priority revision chaining | Client sends current Ticket version and refreshes it from each successful owner/priority response | `client/tests/lab-04/TicketAggregateVersion.test.tsx` | Pass (Issue #76 hardening) |
| UI-05 | UI Style | FR-20 / AC-20 | Zen Green/field-state/status styling | Required labels/states/non-color cues; current/historical/read-only Action presentation remains distinct | `client/tests/lab-04/ui-style.test.tsx` | Pass (Issue #69) |
| RESP-01 | Responsive | FR-20 / AC-20 | Dashboard/Actions layouts | Responsive component structure plus real-browser desktop/tablet/mobile overflow checks show no material clipping/overlap/page overflow | `client/tests/lab-04/responsive.test.tsx`, `e2e/lab-04/visual-hardening.spec.ts` | Pass (Issue #69) |
| A11Y-01 | Accessibility | FR-20 / AC-20 | Keyboard/focus/labels | Semantic navigation, labels, active-page state, field-linked validation, visible dashboard focus, non-color cues | `client/tests/lab-04/accessibility.test.tsx`, `e2e/lab-04/visual-hardening.spec.ts` | Pass (Issue #69) |
| REG-01 | Regression | FR-18, BR-48 / AC-21, AC-22 | Server Labs 1-3 representative regression | Existing behavior remains covered under the Lab 4 concurrency/Administrator contract; migration/seed use an isolated `_test` database | Existing `server/tests/lab-01`, `lab-02`, `lab-03` suites | Pass (Issue #68) |
| REG-02 | Regression | BR-48 / AC-21, AC-22 | Client Labs 1-3 regression | Existing permitted behavior remains covered; deterministic test `localStorage` avoids Node 25 host leakage | Existing `client/tests/lab-01`, `lab-02`, `lab-03` suites | Pass (Issue #68; full client 24 files / 110 tests incl. Lab 4) |
| PERF-01 | Performance smoke | FR-15 / AC-12 | Dashboard/Action query smoke | Concise bounded payloads over seeded local data | `server/tests/lab-04/performance-smoke.test.ts` | Pass (Issue #68) |
| E2E-01 | E2E | AC-01-AC-07, AC-15, AC-18 | Actions Taken flow | Create/assign/reassign/edit/start/assignee-complete/cancel + Requester read-only | `e2e/lab-04/actions-taken-flow.spec.ts` | Pass (Issue #68; desktop/tablet/mobile) |
| E2E-02 | E2E | AC-08-AC-10, AC-13, AC-15 | Ticket resolution cycles | Gate, Admin/Staff transitions, reopen new cycle, stale feedback | `e2e/lab-04/ticket-resolution.spec.ts` | Pass (Issue #68; desktop/tablet/mobile) |
| E2E-03 | E2E | AC-11-AC-14 | Dashboards | Requester isolation, authoritative metrics, current-user drill-down, safe failure/retry | `e2e/lab-04/dashboards.spec.ts` | Pass (Issue #68; desktop/tablet/mobile) |
| E2E-04 | E2E/Regression | AC-21, AC-22 | Complete-product regression | Authentication, Requester flow, Staff APIs/Detail, Comments/Notes, Administrator management and responsive evidence remain usable | Existing `e2e/lab-03` under the final Lab 4 schema | Pass (Issue #68; desktop 7/7) |

### Acceptance-Criterion Traceability

| AC | Planned evidence |
|---|---|
| AC-01 | API-01, API-04, API-09, UI-01, E2E-01 |
| AC-02 | UNIT-05, API-02, E2E-01 |
| AC-03 | API-03, API-11, UI-01, E2E-01 |
| AC-04 | API-04, API-05, API-06A, API-10, UI-01, UI-01A, E2E-01 |
| AC-05 | UNIT-01, API-06, API-06A, API-10, UI-01, UI-01A, E2E-01 |
| AC-06 | UNIT-01, UNIT-02, API-07, API-08, API-10, UI-01, E2E-01 |
| AC-07 | UNIT-02, API-08, API-14A, UI-01, E2E-01 |
| AC-08 | UNIT-03, API-12, API-13, API-17, UI-04, E2E-02 |
| AC-09 | UNIT-03, API-14, API-14A, API-16, API-17, UI-04, E2E-02 |
| AC-10 | UNIT-03, API-15, UI-01A, UI-04, E2E-02 |
| AC-11 | UNIT-04, API-19, API-19A, UI-02, E2E-03 |
| AC-12 | UNIT-04, API-20, API-20A, PERF-01, UI-03, E2E-03 |
| AC-13 | API-11, API-16, API-21, UI-03, UI-04, E2E-02, E2E-03 |
| AC-14 | API-22, UI-02, UI-03, E2E-03 |
| AC-15 | API-05, API-18, API-18A, UI-04, UI-04A, E2E-01, E2E-02 |
| AC-16 | MIG-01, MIG-02, REG-01 |
| AC-17 | SEED-01 |
| AC-18 | API-10, E2E-01 |
| AC-19 | API-02, UI-01, E2E-01 |
| AC-20 | UI-05, RESP-01, A11Y-01, E2E-01, E2E-03 |
| AC-21 | REG-01, REG-02, E2E-04 |
| AC-22 | All required planned levels; release verification summary |

No Acceptance Criterion is intentionally left without planned evidence.

## Verification Approach

Lab 4 follows Test DD and TDD. For each implementation Issue, the planned automated scenario is written first, confirmed to fail for the expected missing Lab 4 behavior where applicable, then the smallest compliant implementation is added and the affected regression set is rerun.

Required levels from the handout are represented below: unit, API/integration, UI component, UI style, responsive, authorization, workflow, migration/regression, performance-smoke, and E2E. Labs 1-3 tests remain regression evidence; a historical Lab 3 defect is not repaired by rewriting an old Lab 3 branch. Any change required by an explicit Lab 4 requirement is implemented as Lab 4 work through the current Lab 4 Issue/PR flow.

### TDD Checkpoint Rule

For Issues 2-5, planned automated tests for the Issue are introduced before or alongside implementation and must demonstrate the missing/incorrect Lab 4 behavior for the expected reason before the corresponding implementation is accepted. Contract corrections from PR #71 are the source of truth: current-cycle positive completion evidence, parent+child CAS, assignee-only completion, append-only Action events, deterministic error taxonomy, and active-parent/current-cycle dashboard rules must be tested rather than the superseded draft behavior. A pre-existing Lab 3 regression failure is recorded separately and does not justify rewriting a completed Lab 3 branch.

### Test Commands

Run commands from the repository root unless a directory change is shown. This is the Lab 4 test entrypoint; integration tests that manipulate database state must use an isolated PostgreSQL `_test` database and the documented test setup.

```bash
cd server && npm run build
cd client && npx vitest run tests/lab-04
npx playwright test e2e/lab-04
```

The three commands above are **separate terminal invocations**; run the client command from the repository root, not inside `server/`. For full server regressions, follow the isolated-database and grouped execution evidence below. Release verification must rerun applicable Labs 1–3 regression commands from integrated `lab4-staging` and then final `main`. No final-release pass is claimed before those executions.

### Responsive and Visual Checklist

Verified in Issue #69 screenshots, component tests, existing Labs 2–3 UI regressions, and the final integrated browser runs summarized below. The full visual review and screenshot map remain in `ui-spec.md`.

- [x] Desktop `>= 992px`: Dashboard cards/lists and Actions Taken controls fit without material clipping/overlap.
- [x] Tablet `768-991px`: dense tables convert/reflow according to `ui-spec.md`; controls remain reachable.
- [x] Mobile `< 768px`: single-column/card layouts; no page-level horizontal scrolling.
- [x] Editable and read-only fields are visually distinct.
- [x] Action/Ticket statuses and priorities use text labels plus badges; meaning is not color-only.
- [x] Follow-up validation appears at the related field.
- [x] Busy/disabled controls cannot be double-submitted (covered by existing form and Actions regression tests).
- [x] Keyboard focus remains visible (browser metric focus and existing keyboard tests).
- [x] Empty, forbidden, conflict, not-found, and safe-failure states have readable feedback (covered by the relevant UI/API and browser regressions; not all states have dedicated screenshots).
- [x] Long Action descriptions/results/notes wrap without hiding controls.
- [x] Public Comments/Internal Notes keep the Lab 3 privacy distinction (role/API and UI regression).

## Verified Results Before Final main Release

The results below come from verified Lab 4 feature-branch and PR-correction runs, not from a yet-to-occur final-`main` release run. Following the Lab 1 evidence format, each result must keep its execution context; final integrated/`main` evidence will be added only after those checks actually run.

### Integrated Lab 4 Release-Candidate Verification (Issue #70, 2026-10-31)

All commands below were run on `feature/lab4-8-release-evidence`, which branches from integrated `lab4-staging` at merge `a032df1`. Its changes so far are documentation/evidence only; the tested product code is the integrated Lab 4 code. The test run used local development tooling and an isolated PostgreSQL `toktickit_lab3_suite_test` database for destructive migration/seed and E2E setups, **not** a development database. No hosted CI or final-`main` verification is implied.

| Level | Exact verification scope | Result |
|---|---|---|
| Client full regression | `cd client && npx vitest run --reporter=dot` | **27 files / 116 tests passed**; existing React `act(...)` warnings in older Login/ChangePassword tests did not fail tests |
| Server Labs 1–2 | `cd server && npx vitest run --no-file-parallelism tests/lab-01 tests/lab-02 --reporter=dot` | **10 files / 42 tests passed** |
| Server Lab 3 without migration/seed | `cd server && npx vitest run --no-file-parallelism tests/lab-03 --exclude '**/*migration.integration.test.ts' --exclude '**/*seed.integration.test.ts' --reporter=dot` | **13 files / 136 tests passed** |
| Server Lab 4 without migration/seed | Nine explicit `server/tests/lab-04` unit/API/performance-smoke files, serial Vitest | **9 files / 55 tests passed** |
| Lab 3 and Lab 4 migration/seed | Four explicit `migration.integration.test.ts` / `seed.integration.test.ts` files, serial Vitest with `TEST_DATABASE_URL` targeting isolated `_test` DB | **4 files / 10 tests passed** |
| Lab 4 E2E | `npx playwright test e2e/lab-04 --reporter=line` | **33/33 passed** — 11 desktop, 11 tablet, 11 mobile |
| Lab 3 E2E regression | `npx playwright test e2e/lab-03 --project=desktop --reporter=line` | **7/7 passed** |
| Production builds | `cd server && npm run build`; `cd client && npm run build` | **Both passed** |
| Diff check | `git diff --check` | **Passed** |

**Total server Vitest evidence:** 243 passing tests across 36 files when the non-overlapping groups above are combined. These groups were run separately to protect database fixtures; they are not a claim that a single `npm test` command ran all 36 files together.

**Committed raw command output:** `artifacts/lab-04/verification/` contains `client-all.log`, `server-lab1-lab2.log`, `server-lab3.log`, `server-lab4.log`, `migration-seed.log`, `playwright-lab4.log`, `playwright-lab3.log`, and `builds.log`. Reviewers can compare the numeric summaries above against these local execution logs. They are source-run evidence, not hosted GitHub Actions artifacts.

**Release-candidate checkpoint (historical):** At that stage the reviewed `lab4-staging → main` merge and final-main verification were pending. Both subsequently completed; the exact post-merge evidence is recorded in the final `main` section below. Issue #70 closure follows the separate evidence review.

### Server

Previous Lab 4 API/unit/integration and Labs 1–3 backend regression runs are recorded below. The server production build passed in Issue #69. No full-server-suite result from final `main` is claimed yet.

### Client

```bash
cd client
npx vitest run tests/lab-04
npm run build
```

Issue #69 results: **8 Lab 4 files / 19 tests passed**, and the production build passed. The full client suite (Labs 1–4) also passed during Issue #68 (24 files / 110 tests).

### End-to-end

```bash
npx playwright test e2e/lab-04 --project=desktop
npx playwright test e2e/lab-04 --project=tablet
npx playwright test e2e/lab-04 --project=mobile
```

Issue #69 results: **11/11 passed in each viewport project** (33 passing executions total). Nine authentic screenshots are committed under `artifacts/lab-04/screenshots/`. This does not replace the required post-release verification on final `main`.

### Previous Issue-by-Issue Evidence

Issue #63 was documentation-only and did not claim implementation passes. Issue #64 now records actual backend-foundation evidence:

- `npm run build` — Pass.
- `npm run test:lab4:foundation` — Pass: 4 files, 21 tests.
- Full server regression with `npx vitest run --no-file-parallelism` — Pass: 29 files, 207 tests.
- Migration evidence covers Lab 3-shaped data preservation, Ticket `version=0`, `workflowCycle=1`, legacy `resolvedAt` backfill, and preservation of legacy no-Action Tickets.
- Seed evidence runs twice and verifies zero/one/many Action coverage without duplicate `clientRequestId` rows.

The PR #72 review fix adds direct regression coverage for safe cross-Ticket UUID collision behavior, concurrent exact replay, concurrent conflicting replay, and authoritative locked-cycle fingerprinting. Replayed/failed paths are verified not to duplicate Action rows, audit events, or Ticket-version increments.

Issue #65 Actions Taken Ticket Detail UI evidence:

- `cd client && npm run build` — Pass.
- Focused Lab 4 + affected Lab 3 UI regression — Pass: 3 files, 11 tests (`ActionsTaken`, Staff Ticket Detail, Requester Ticket Detail).
- `cd server && npm run build` — Pass.
- Affected server regression — Pass: 2 files, 47 tests (`staff-ticket-detail.api` and `actions-taken.api`).
- An earlier full-client attempt under Node.js 25.8.0 exposed a host `localStorage` object without working Storage methods. Issue #68 corrected the test harness only (not product behavior) with deterministic in-memory Storage; the final full client run then passed 24 files / 110 tests.

Issue #66 final Ticket workflow evidence:

- `ticket-workflow.unit.test.ts` + `ticket-workflow.api.test.ts` — Pass: 2 files / 26 tests, including every permitted final matrix edge, current-cycle resolution gate, follow-up metadata semantics, Administrator parity, reopen cycle increment, and stale aggregate rejection.
- `TicketWorkflow.test.tsx` + `ActionsTaken.test.tsx` — Pass: 2 files / 6 tests.
- Focused Requester advisory regression from `staff-ticket-detail.api.test.ts` — Pass: 9 tests; `Problem Appears Resolved` remains advisory only.
- Server and client production builds — Pass.
- A broad `server/tests/lab-04` invocation was also attempted; ordinary Lab 4 unit/API files passed, while migration/seed integration suites correctly refused to run because `TEST_DATABASE_URL` was not supplied in that command. No pass is claimed for those two integration files from this run.
- The older Lab 3 UI assertion that Administrator status controls must remain hidden is superseded by the approved Lab 4 BR-21/FR-14 Administrator support/testing authority. The historical Lab 3 test file is not rewritten retroactively.

Issue #68 final E2E and Labs 1-3 regression evidence:

- Client full Vitest suite — Pass: 24 files / 110 tests.
- Server Labs 1-2 — Pass: 10 files / 42 tests.
- Server Lab 3 affected/full regression was run serially to preserve shared database-fixture isolation: Staff Detail 31/31; Staff Queue/comments/authz/requester/regression group 56/56; attachment/guard/status unit group 8/8; Lab 3 migration/seed integration 8/8 on isolated `toktickit_lab3_suite_test`; authentication and Administrator suites also passed during the final regression sequence.
- Server Lab 4 non-migration suite — Pass: 9 files / 55 tests, including `PERF-01`; Lab 4 migration/seed integration — Pass: 2/2 on the isolated `_test` database.
- Lab 4 Playwright E2E — Pass: desktop 8/8, tablet 8/8, mobile 8/8. The E2E setup resets the isolated database, deploys the Lab 4 schema, and seeds Lab 4 data before each project run. The final correction round adds direct stale Ticket-revision feedback/no-overwrite coverage for E2E-02 and cross-Requester metric/recent-list isolation for E2E-03.
- Existing Lab 3 Playwright E2E under the final Lab 4 schema — Pass: desktop 7/7, covering authentication/password change, Requester continuity, Staff Queue/Detail/API protection, Administrator user management, accessibility focus, and responsive visual evidence.
- Server build, client production build, and `git diff --check` — Pass.
- Lab 3 regression tests were updated only on the Lab 4 branch where the approved Lab 4 contract intentionally changes required `expectedTicketVersion`, Administrator status/Queue authority, and cleanup dependencies introduced by `ActionTaken`; no completed Lab 3 branch/history was rewritten.

Issue #69 responsive/accessibility/visual-hardening evidence:

- Lab 4 UI style/responsive/accessibility + affected dashboard/Actions component tests — Pass: 6 files / 15 tests during the focused hardening run; complete `client/tests/lab-04` rerun — Pass: 8 files / 19 tests.
- `visual-hardening.spec.ts` — Pass: 9/9 across the three required viewport projects when run standalone; it verifies active navigation, visible metric focus, no horizontal overflow, Actions validation association, runtime console/page errors after successful authentication, and captures actual screenshots.
- Required screenshot evidence exists for Staff Dashboard, Requester Dashboard, and Actions Taken at desktop 1440×900, tablet 820×1180, and mobile 390×844 under `artifacts/lab-04/screenshots/`.
- Final visual inspection of generated evidence found no material clipping, overlap, hidden required action, or page-level horizontal scrolling. Long Action values wrap inside labeled read-only blocks; mobile forms/actions stack or wrap without leaving the viewport.
- Actions Taken field validation now sets `aria-invalid` and `aria-describedby` for Action Description, Assignee, and conditional Follow-up Note. Read-only Action values use the approved read-only surface treatment; the programmatically focusable dashboard Actions section has an explicit visible focus outline.
- README is updated from Lab 3-current wording to the Lab 4 migration/seed/test/evidence workflow.

## Verified Results on Final `main` (Issue #70 post-release, 2026-10-31)

**Exact checkout:** `main` at merge commit `64dd4f012af2f99b6a4c1f460599beeb9f712821`, produced by the independently approved and peer-merged [release PR #83](https://github.com/cottonlnwza/toktickit/pull/83). All results below were rerun **after** merge. They are locally executed tests with raw logs under `artifacts/lab-04/verification/final-main/`, not hosted CI. Destructive migrations, seed and browser setup used the isolated PostgreSQL `_test` database, not the development database.

| Final `main` verification scope | Actual result |
|---|---|
| Client full Vitest regression | **27 files / 116 tests PASS** |
| Server Labs 1–2 | **10 files / 42 tests PASS** |
| Server Lab 3 (nonmigration) | **13 files / 136 tests PASS** |
| Server Lab 4 (nonmigration) | **9 files / 55 tests PASS** |
| Lab 3 and Lab 4 migrations/seed (isolated `_test` DB) | **4 files / 10 tests PASS** |
| **Server total, nonoverlapping groups** | **36 files / 243 tests PASS** |
| Lab 4 Chromium Playwright — desktop/tablet/mobile | **33/33 PASS (11 per project)** |
| Lab 3 Chromium Playwright — desktop | **7/7 PASS** |
| Server and client production builds | **Both PASS** |

The Server groups were executed **sequentially**, rather than as one unrestricted command, to preserve shared database-fixture isolation. Existing React `act(...)` warnings in earlier UI tests did not fail any test. Nine final-main screenshot captures were refreshed by the Lab 4 browser suite, and no Lab 1–3 tracked screenshots were intentionally changed. This section verifies the released product code before the separate documentation/evidence update is peer-reviewed; it does not claim future approvals.

## Known Limitations or Deferred Tests

- External notifications, SLA engines, advanced BI/reporting, multi-tenant behavior, billing/costing, and production cloud load tests are excluded by the Lab 4 handout.
- Broad production-scale performance testing is excluded. `PERF-01` is a course-appropriate smoke check over seeded/local data and concise endpoint payloads.
- Historical Lab 3 defects discovered during regression are not repaired by changing old Lab 3 branches; only explicit Lab 4 requirements may justify new Lab 4 changes in shared code.
