# Lab 4 Test Plan and Results

Status: Planned before Lab 4 implementation. Final result cells must be updated only from actual executed evidence.

## 1. Test Strategy

Lab 4 follows Test DD and TDD. For each implementation Issue, the planned automated scenario is written first, confirmed to fail for the expected missing Lab 4 behavior where applicable, then the smallest compliant implementation is added and the affected regression set is rerun.

Required levels from the handout are represented below: unit, API/integration, UI component, UI style, responsive, authorization, workflow, migration/regression, performance-smoke, and E2E. Labs 1-3 tests remain regression evidence; a historical Lab 3 defect is not repaired by rewriting an old Lab 3 branch. Any change required by an explicit Lab 4 requirement is implemented as Lab 4 work through the current Lab 4 Issue/PR flow.

## 2. Planned Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-12, BR-13 / AC-05, AC-06 | Action status transition helper | Only PLANNED -> IN_PROGRESS/CANCELLED and IN_PROGRESS -> COMPLETED/CANCELLED allowed | `server/tests/lab-04/actions-taken.unit.test.ts` | Planned |
| UNIT-02 | Unit | BR-06-BR-09 / AC-06, AC-07 | Action text/follow-up validation | Required/conditional lengths and nulling behavior enforced | `server/tests/lab-04/actions-taken.unit.test.ts` | Planned |
| UNIT-03 | Unit | BR-21-BR-24 / AC-08, AC-09 | Final Ticket transition/resolution helper | Existing matrix preserved; incomplete Action blocks RESOLVED | `server/tests/lab-04/ticket-workflow.unit.test.ts` | Planned |
| UNIT-04 | Unit | BR-26-BR-39 / AC-10, AC-11 | Dashboard calculation helpers/query boundaries | Active-status sets, rolling windows, zero buckets, limits and ordering match contract | `server/tests/lab-04/dashboard.unit.test.ts` | Planned |
| API-01 | API | FR-01-FR-06 / AC-01 | Create valid Action Taken | 201; correct Ticket, assignee, createdAt, status PLANNED, version 0 | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-02 | API | BR-18 / AC-02 | Retry-safe Action create | Exact replay returns original; no duplicate row; conflict returns 409 | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-03 | API | FR-07 / AC-03 | Requester Action visibility/write restriction | Owned Ticket Actions readable; create/update/status forbidden | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-04 | API | BR-10, BR-11 / AC-01, AC-04 | Assignee validation | Active IT Staff/Admin accepted; inactive/Requester assignee rejected safely | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-05 | API | BR-14, BR-40 / AC-04, AC-14 | Edit non-terminal Action + stale version | Valid edit increments version; stale/terminal edit rejected without overwrite | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-06 | API | BR-13 / AC-05 | Action status transitions | Valid transition succeeds; invalid transition rejected | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-07 | API | BR-07, BR-15 / AC-06 | Complete Action | Result required; performer/completedAt assigned by backend | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-08 | API | BR-08 / AC-07 | Follow-up conditional validation | Blank note rejected when required; note persisted/null as contracted | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-09 | Authorization | FR-16 / AC-03, AC-04 | Direct Action role authorization | Requester/unauthenticated/forbidden requests cannot mutate protected data | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-10 | Workflow/API | BR-21-BR-25 / AC-08 | Resolve with incomplete Action | 409 resolution-gate error; Ticket remains unchanged | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-11 | Workflow/API | BR-21-BR-25 / AC-09 | Resolve with zero/terminal Actions | Allowed transition succeeds and sets resolvedAt | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-12 | Workflow/API | BR-21, BR-22 / AC-08, AC-09 | Final Ticket transition matrix | Every allowed edge succeeds; disallowed edges fail server-side | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-13 | Workflow/API | BR-24 / AC-08, AC-09 | Requester resolution indication regression | Indication remains advisory and never changes Ticket status | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-14 | Concurrency/API | BR-40 / AC-14 | Stale Ticket workflow update | Stale expectedVersion returns 409 and preserves newer state | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-15 | Dashboard/API | BR-27-BR-30 / AC-10 | Requester dashboard ownership/calculations | Only authenticated Requester data; counts/lists match fixtures | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| API-16 | Dashboard/API | BR-31-BR-37 / AC-11 | Staff dashboard calculations | Counts/action lists match authoritative fixtures; zero buckets explicit | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| API-17 | Authorization | BR-38 / AC-12 | Administrator staff-dashboard reuse | Administrator allowed; Requester forbidden | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| API-18 | Dashboard/API | BR-39 / AC-13 | Drill-down metadata/query intent | Returned links/query metadata map to supported Queue/My Tickets/Detail filters | `server/tests/lab-04/requester-dashboard.api.test.ts`; `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| MIG-01 | Migration/Integration | FR-18 / AC-15 | Lab 3-shaped database migration preservation | Existing rows/relationships survive; new fields/schema valid | `server/tests/lab-04/migration.integration.test.ts` | Planned |
| MIG-02 | Migration/Integration | Data 8.3 / AC-15 | Legacy version/resolvedAt backfill | version=0; existing RESOLVED/CLOSED get resolvedAt=updatedAt; others null | `server/tests/lab-04/migration.integration.test.ts` | Planned |
| SEED-01 | Integration | FR-19 / AC-16 | Seed idempotency/coverage | Repeated run creates no duplicates; zero/one/many Actions and dashboard fixtures exist | `server/tests/lab-04/seed.integration.test.ts` | Planned |
| UI-01 | UI Component | FR-02-FR-07 / AC-01, AC-03-AC-07 | Actions Taken list/create/edit/status UI | Role-appropriate controls, fields, validation and states render correctly | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-02 | UI Component | FR-12 / AC-10, AC-13 | Requester Dashboard | Owned metrics/recent cards, empty/failure, drill-down navigation | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned |
| UI-03 | UI Component | FR-13, FR-14 / AC-11-AC-13 | Staff/Admin Dashboard | Metrics, current-user Actions, urgent list, forbidden/failure, drill-down | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| UI-04 | UI Component | FR-09-FR-11 / AC-08, AC-09, AC-14 | Ticket workflow controls | Only allowed next statuses shown; conflict/gate feedback; refreshed summary | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |
| UI-05 | UI Style | FR-20 / AC-18 | Zen Green/field-state/status styling | Required classes/labels, editable vs read-only, non-color cues, validation placement | `client/tests/lab-04/ui-style.test.tsx` | Planned |
| RESP-01 | Responsive | FR-20 / AC-18 | Dashboard/Actions layouts at breakpoints | No material clipping/overlap/page horizontal overflow | `client/tests/lab-04/responsive.test.tsx` | Planned |
| A11Y-01 | Accessibility | FR-20 / AC-18 | Keyboard/focus/labels | Focus visible; controls labeled; dialogs/status not color-only | `client/tests/lab-04/accessibility.test.tsx` | Planned |
| REG-01 | Regression | FR-18, BR-44 / AC-19, AC-20 | Server Labs 1-3 representative regression | Actual result recorded; no old branch rewrite | Existing `server/tests/lab-01`, `lab-02`, `lab-03` suites | Planned |
| REG-02 | Regression | BR-44 / AC-19, AC-20 | Client Labs 1-3 representative regression | Existing permitted screens/navigation behavior remains covered | Existing `client/tests/lab-01`, `lab-02`, `lab-03` suites | Planned |
| PERF-01 | Performance smoke | FR-15 / AC-11 | Dashboard/Action list query smoke | Seed-sized dashboard and Ticket Action retrieval complete without unbounded collection payloads | `server/tests/lab-04/performance-smoke.test.ts` | Planned |
| E2E-01 | E2E | AC-01-AC-07 | Actions Taken flow | Staff creates/assigns/edits/transitions/completes/cancels; Requester sees read-only | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| E2E-02 | E2E | AC-08, AC-09, AC-14 | Ticket resolution flow | Resolution gate, permitted transitions and stale/conflict feedback verified | `e2e/lab-04/ticket-resolution.spec.ts` | Planned |
| E2E-03 | E2E | AC-10-AC-13 | Dashboards | Requester isolation, Staff metrics/current actions, drill-down, empty/failure states | `e2e/lab-04/dashboards.spec.ts` | Planned |
| E2E-04 | E2E/Regression | AC-19, AC-20 | Representative complete-product regression | Authentication, My Tickets, Detail, Attachments, Comments, Staff, Notes, Admin remain usable | Existing Lab 3 E2E plus Lab 4 release verification command | Planned |

## 3. Acceptance-Criterion Traceability

| AC | Planned evidence |
|---|---|
| AC-01 | API-01, API-04, UI-01, E2E-01 |
| AC-02 | API-02, E2E-01 |
| AC-03 | API-03, API-09, UI-01, E2E-01 |
| AC-04 | API-04, API-05, UI-01, E2E-01 |
| AC-05 | UNIT-01, API-06, UI-01, E2E-01 |
| AC-06 | UNIT-01, UNIT-02, API-07, UI-01, E2E-01 |
| AC-07 | UNIT-02, API-08, UI-01, E2E-01 |
| AC-08 | UNIT-03, API-10, API-12, API-13, UI-04, E2E-02 |
| AC-09 | UNIT-03, API-11, API-12, API-13, UI-04, E2E-02 |
| AC-10 | UNIT-04, API-15, UI-02, E2E-03 |
| AC-11 | UNIT-04, API-16, PERF-01, UI-03, E2E-03 |
| AC-12 | API-17, UI-03, E2E-03 |
| AC-13 | API-18, UI-02, UI-03, E2E-03 |
| AC-14 | API-05, API-14, UI-04, E2E-02 |
| AC-15 | MIG-01, MIG-02, REG-01 |
| AC-16 | SEED-01 |
| AC-17 | API-02, UI-01, E2E-01 |
| AC-18 | UI-05, RESP-01, A11Y-01, E2E-01, E2E-03 |
| AC-19 | REG-01, REG-02, E2E-04 |
| AC-20 | All required planned levels; release verification summary |

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

Release verification must also run the documented existing Labs 1-3 regression commands from the integrated `lab4-staging`/final `main` state. No result is marked Pass until the command actually completes successfully.

## 6. TDD Checkpoint Rule

For Issues 2-5, planned automated tests for the Issue are introduced before or alongside implementation and must demonstrate the missing/incorrect Lab 4 behavior for the expected reason before the corresponding implementation is accepted. A pre-existing Lab 3 regression failure is recorded separately and does not justify rewriting a completed Lab 3 branch.

## 7. Final Results

Not executed for Issue #63 because this Issue establishes the pre-implementation contract. Final statuses will be updated only from actual test output in later reviewed Lab 4 Issues.

## 8. Known Limitations or Deferred Tests

- External notifications, SLA engines, advanced BI/reporting, multi-tenant behavior, billing/costing, and production cloud load tests are excluded by the Lab 4 handout.
- Broad production-scale performance testing is excluded. `PERF-01` is a course-appropriate smoke check over seeded/local data and concise endpoint payloads.
- Historical Lab 3 defects discovered during regression are not repaired by changing old Lab 3 branches; only explicit Lab 4 requirements may justify new Lab 4 changes in shared code.
