# Lab 4 Test Plan and Results

Status: Planned before Lab 4 implementation. Final result cells must be updated only from actual executed evidence.

## 1. Test Strategy

Lab 4 follows Test DD and TDD. For each implementation Issue, the planned automated scenario is written first, confirmed to fail for the expected missing Lab 4 behavior where applicable, then the smallest compliant implementation is added and the affected regression set is rerun.

Required levels from the handout are represented below: unit, API/integration, UI component, UI style, responsive, authorization, workflow, migration/regression, performance-smoke, and E2E. Labs 1-3 tests remain regression evidence; a historical Lab 3 defect is not repaired by rewriting an old Lab 3 branch. Any change required by an explicit Lab 4 requirement is implemented as Lab 4 work through the current Lab 4 Issue/PR flow.

## 2. Planned Tests

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
| UI-02 | UI Component | FR-12 / AC-11, AC-14 | Requester Dashboard | Owned metrics/recent cards, empty state, role navigation, drill-down | `client/tests/lab-04/RequesterDashboard.test.tsx` | Pass (Issue #67) |
| UI-03 | UI Component | FR-13, FR-14 / AC-12-AC-14 | Staff/Admin Dashboard | Current-work metrics, Admin reuse, empty state, role navigation, drill-down | `client/tests/lab-04/StaffDashboard.test.tsx` | Pass (Issue #67) |
| UI-04 | UI Component | FR-09-FR-11 / AC-08-AC-10, AC-13, AC-15 | Ticket workflow controls | Current-cycle gate, Admin parity, reopen cycle, stale feedback | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass (Issue #66: 3 tests) |
| UI-04A | UI Component | BR-42-BR-44 / AC-15 | Owner/priority revision chaining | Client sends current Ticket version and refreshes it from each successful owner/priority response | `client/tests/lab-04/TicketAggregateVersion.test.tsx` | Pass (Issue #76 hardening) |
| UI-05 | UI Style | FR-20 / AC-20 | Zen Green/field-state/status styling | Required labels/states/non-color cues | `client/tests/lab-04/ui-style.test.tsx` | Planned |
| RESP-01 | Responsive | FR-20 / AC-20 | Dashboard/Actions layouts | No material clipping/overlap/page overflow | `client/tests/lab-04/responsive.test.tsx` | Planned |
| A11Y-01 | Accessibility | FR-20 / AC-20 | Keyboard/focus/labels | Focus visible; controls/dialogs labeled; status non-color-only | `client/tests/lab-04/accessibility.test.tsx` | Planned |
| REG-01 | Regression | FR-18, BR-48 / AC-21, AC-22 | Server Labs 1-3 representative regression | Actual result recorded; no old-branch rewrite | Existing `server/tests/lab-01`, `lab-02`, `lab-03` suites | Pass (Issue #64) |
| REG-02 | Regression | BR-48 / AC-21, AC-22 | Client Labs 1-3 representative regression | Existing permitted behavior remains covered | Existing `client/tests/lab-01`, `lab-02`, `lab-03` suites | Planned |
| PERF-01 | Performance smoke | FR-15 / AC-12 | Dashboard/Action query smoke | Concise bounded payloads over seeded local data | `server/tests/lab-04/performance-smoke.test.ts` | Planned |
| E2E-01 | E2E | AC-01-AC-07, AC-15, AC-18 | Actions Taken flow | Create/assign/reassign/edit/start/assignee-complete/cancel + Requester read-only | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| E2E-02 | E2E | AC-08-AC-10, AC-13, AC-15 | Ticket resolution cycles | Gate, Admin/Staff transitions, reopen new cycle, stale feedback | `e2e/lab-04/ticket-resolution.spec.ts` | Planned |
| E2E-03 | E2E | AC-11-AC-14 | Dashboards | Requester isolation, exact windows, active/current-cycle staff metrics, drill-down | `e2e/lab-04/dashboards.spec.ts` | Planned |
| E2E-04 | E2E/Regression | AC-21, AC-22 | Complete-product regression | Authentication, My Tickets, Detail, Attachments, Comments, Staff, Notes, Admin remain usable | Existing Lab 3 E2E plus Lab 4 release verification command | Planned |

## 3. Acceptance-Criterion Traceability

| AC | Planned evidence |
|---|---|
| AC-01 | API-01, API-04, API-09, UI-01, E2E-01 |
| AC-02 | UNIT-05, API-02, E2E-01 |
| AC-03 | API-03, API-11, UI-01, E2E-01 |
| AC-04 | API-04, API-05, API-10, UI-01, E2E-01 |
| AC-05 | UNIT-01, API-06, API-10, UI-01, E2E-01 |
| AC-06 | UNIT-01, UNIT-02, API-07, API-08, API-10, UI-01, E2E-01 |
| AC-07 | UNIT-02, API-08, API-14A, UI-01, E2E-01 |
| AC-08 | UNIT-03, API-12, API-13, API-17, UI-04, E2E-02 |
| AC-09 | UNIT-03, API-14, API-14A, API-16, API-17, UI-04, E2E-02 |
| AC-10 | UNIT-03, API-15, UI-04, E2E-02 |
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

## 4. Responsive and Visual Checklist

Final status must be filled from actual visual inspection/screenshots.

- [ ] Desktop `>= 992px`: Dashboard cards/lists and Actions Taken controls fit without material clipping/overlap.
- [ ] Tablet `768-991px`: dense tables convert/reflow according to `ui-spec.md`; controls remain reachable.
- [ ] Mobile `< 768px`: single-column/card layouts; no page-level horizontal scrolling.
- [ ] Editable and read-only fields are visually distinct.
- [ ] Action/Ticket statuses and priorities use text labels plus badges; meaning is not color-only.
- [ ] Follow-up validation appears at the related field.
- [ ] Busy/disabled controls cannot be double-submitted.
- [ ] Keyboard focus remains visible.
- [ ] Empty, forbidden, conflict, not-found, and safe-failure states are readable.
- [ ] Long Action descriptions/results/notes wrap without hiding controls.
- [ ] Public Comments/Internal Notes keep the Lab 3 privacy distinction.

## 5. Test Commands

Exact commands are finalized when the related files exist. Planned repository-level commands:

```bash
cd server && npm test
cd client && npm test
npx playwright test e2e/lab-04
```

Release verification must also run the documented existing Labs 1-3 regression commands from the integrated `lab4-staging`/final `main` state. No result is marked Pass until the command actually completes successfully. This repository currently has no hosted GitHub Actions check configured for this docs-only contract PR; therefore exact-head evidence for Issue #63 is local `git show --check HEAD` plus the contract sanity script, reported in the PR after the final docs commit.

## 6. TDD Checkpoint Rule

For Issues 2-5, planned automated tests for the Issue are introduced before or alongside implementation and must demonstrate the missing/incorrect Lab 4 behavior for the expected reason before the corresponding implementation is accepted. Contract corrections from PR #71 are the source of truth: current-cycle positive completion evidence, parent+child CAS, assignee-only completion, append-only Action events, deterministic error taxonomy, and active-parent/current-cycle dashboard rules must be tested rather than the superseded draft behavior. A pre-existing Lab 3 regression failure is recorded separately and does not justify rewriting a completed Lab 3 branch.

## 7. Final Results

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
- A full client Vitest run was attempted under local Node.js 25.8.0, but the legacy Lab 1-3 test environment failed broadly because `localStorage` was exposed without working `getItem`/`setItem`/`clear` functions and Node emitted an invalid `--localstorage-file` warning. Therefore `REG-02` remains Planned and no full-client regression pass is claimed from that run.

Issue #66 final Ticket workflow evidence:

- `ticket-workflow.unit.test.ts` + `ticket-workflow.api.test.ts` — Pass: 2 files / 26 tests, including every permitted final matrix edge, current-cycle resolution gate, follow-up metadata semantics, Administrator parity, reopen cycle increment, and stale aggregate rejection.
- `TicketWorkflow.test.tsx` + `ActionsTaken.test.tsx` — Pass: 2 files / 6 tests.
- Focused Requester advisory regression from `staff-ticket-detail.api.test.ts` — Pass: 9 tests; `Problem Appears Resolved` remains advisory only.
- Server and client production builds — Pass.
- A broad `server/tests/lab-04` invocation was also attempted; ordinary Lab 4 unit/API files passed, while migration/seed integration suites correctly refused to run because `TEST_DATABASE_URL` was not supplied in that command. No pass is claimed for those two integration files from this run.
- The older Lab 3 UI assertion that Administrator status controls must remain hidden is superseded by the approved Lab 4 BR-21/FR-14 Administrator support/testing authority. The historical Lab 3 test file is not rewritten retroactively.

## 8. Known Limitations or Deferred Tests

- External notifications, SLA engines, advanced BI/reporting, multi-tenant behavior, billing/costing, and production cloud load tests are excluded by the Lab 4 handout.
- Broad production-scale performance testing is excluded. `PERF-01` is a course-appropriate smoke check over seeded/local data and concise endpoint payloads.
- Historical Lab 3 defects discovered during regression are not repaired by changing old Lab 3 branches; only explicit Lab 4 requirements may justify new Lab 4 changes in shared code.
