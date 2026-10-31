# Lab 4 — Submission Evidence Map (Pre-release Draft)

**Student:** Thanakorn Soison — 67070507205 — GitHub: [@cottonlnwza](https://github.com/cottonlnwza)
**Repository:** [cottonlnwza/toktickit](https://github.com/cottonlnwza/toktickit)
**Current evidence source:** integrated Lab 4 feature code merged to `lab4-staging` (through PR #81, merge `a032df1`), plus Issue #70 evidence updates on `feature/lab4-8-release-evidence`.
**Status:** **DRAFT** until the required independent `lab4-staging → main` review/merge and post-merge verification are complete. Do not submit this draft as a final PDF.

## Answer Part 1

**Git Use with Engineering Workflow (10 points).** The existing [GitHub Project #3](https://github.com/users/cottonlnwza/projects/3) implements Backlog → Specified → Started → PR Review → Fixing (as needed) → PR Review → Done. Feature PRs [#71](https://github.com/cottonlnwza/toktickit/pull/71), [#72](https://github.com/cottonlnwza/toktickit/pull/72), [#73](https://github.com/cottonlnwza/toktickit/pull/73), [#74](https://github.com/cottonlnwza/toktickit/pull/74), [#75](https://github.com/cottonlnwza/toktickit/pull/75), [#78](https://github.com/cottonlnwza/toktickit/pull/78), [#79](https://github.com/cottonlnwza/toktickit/pull/79), [#80](https://github.com/cottonlnwza/toktickit/pull/80), and [#81](https://github.com/cottonlnwza/toktickit/pull/81) were independently approved and peer-merged to `lab4-staging`. This proves the feature-to-staging history, **not yet** the final staging-to-main release.

- [Rendered peer-review record with reviewer identity, actual review comments, responses and approvals](https://github.com/cottonlnwza/toktickit/blob/feature/lab4-8-release-evidence/docs/lab-04/reviewer.md). Includes only genuine Lab 4 reciprocal reviews of another student's PRs.
- [Repository structure](https://github.com/cottonlnwza/toktickit/tree/feature/lab4-8-release-evidence), [README](https://github.com/cottonlnwza/toktickit/blob/feature/lab4-8-release-evidence/README.md), and [.gitignore](https://github.com/cottonlnwza/toktickit/blob/feature/lab4-8-release-evidence/.gitignore).
- **Pending:** peer-reviewed release PR `lab4-staging → main`, Issue #70 Done state, final Project board screenshot and final-main commit history proof.

## Answer Part 2

**Spec DD (5 points).** [Rendered Sprint 4 specification](https://github.com/cottonlnwza/toktickit/blob/feature/lab4-8-release-evidence/docs/lab-04/specification.md) describes 23 FRs, business rules, Actions Taken parent-child accountability, four-state Action lifecycle, eight Ticket statuses, server-enforced resolution gate, role dashboard calculations, authorization, optimistic revisions, preservation migration, idempotent seed and Product Definition of Done. [API contract](https://github.com/cottonlnwza/toktickit/blob/feature/lab4-8-release-evidence/docs/lab-04/api-spec.md) and [UI contract](https://github.com/cottonlnwza/toktickit/blob/feature/lab4-8-release-evidence/docs/lab-04/ui-spec.md) supply the executable detail. The specification was peer-reviewed and merged in [PR #71](https://github.com/cottonlnwza/toktickit/pull/71) **before** the implementation PRs #72 onward; see PR chronology.

The resolution gate requires at least one `COMPLETED` Action in the **current** `workflowCycle` and no `PLANNED`/`IN_PROGRESS` Actions. The Ticket primary owner is distinct from each Action assignee, and only the current assignee may complete that Action. Reopening begins a new cycle; older Actions remain historical. These are approved Lab 4 contract rules, not inferred additions.

## Answer Part 3

**Test DD and Traceability (10 points).** [Rendered Lab 4 test plan, 53 scenario IDs and AC traceability](https://github.com/cottonlnwza/toktickit/blob/feature/lab4-8-release-evidence/docs/lab-04/tests.md) links actual unit, API, UI, migration, performance and E2E source files with status. [Server Lab 4 tests](https://github.com/cottonlnwza/toktickit/tree/feature/lab4-8-release-evidence/server/tests/lab-04), [client Lab 4 tests](https://github.com/cottonlnwza/toktickit/tree/feature/lab4-8-release-evidence/client/tests/lab-04), and [Playwright Lab 4 tests](https://github.com/cottonlnwza/toktickit/tree/feature/lab4-8-release-evidence/e2e/lab-04) are browsable.

**Integrated release-candidate local verification, 2026-10-31:** Server **243/243** tests across 36 files in separately executed non-overlapping groups (Labs 1–2: 42; Lab 3: 136; Lab 4: 55; Lab 3–4 migration/seed: 10), Client **116/116** across 27 files, Lab 4 Playwright **33/33** (desktop/tablet/mobile 11 each), Lab 3 Playwright regression **7/7**, and both production builds passed. Tests with destructive schema setup used an isolated PostgreSQL `_test` database. The 243 server tests were **not** one combined test command. No hosted CI or final-`main` test run is claimed.

[Release-candidate raw test/build logs](https://github.com/cottonlnwza/toktickit/tree/feature/lab4-8-release-evidence/artifacts/lab-04/verification) preserve the executed command output for independent evidence inspection.

**Pending:** repeat and record required checks from the final peer-merged `main` SHA for full grading evidence.

## Answer Part 4

**AI Use with Reflection (5 points).** [Rendered AI-use and reflection document](https://github.com/cottonlnwza/toktickit/blob/feature/lab4-8-release-evidence/docs/lab-04/ai-use.md) names ChatGPT and the connected coding bridge, selects **10 genuine Lab 4 key prompts** in the Lab 1 template, and includes a first-person reflection about scope discipline, TDD, correcting peer-review blockers, and separating AI suggestions from actual test/review evidence.

## Answer Part 5

**Working IT Staff Dashboard UI (5 points).** The Staff/Admin Dashboard displays backend-calculated unassigned Tickets, my Tickets, my open Actions, Ticket status/IT-priority summaries, and recent or urgent Tickets. Metrics use current authenticated identity, current workflow cycle and active parent Ticket rules; they link to filtered Queue/Detail screens instead of becoming a separate Ticket-management interface. Selected counts were checked against direct PostgreSQL queries in the [Issue #67 tests](https://github.com/cottonlnwza/toktickit/blob/feature/lab4-8-release-evidence/server/tests/lab-04/staff-dashboard.api.test.ts). [Dashboard E2E](https://github.com/cottonlnwza/toktickit/blob/feature/lab4-8-release-evidence/e2e/lab-04/dashboards.spec.ts) covers metrics, drill-downs, role isolation and retryable failures.

**Screenshots:** [Desktop](../../artifacts/lab-04/screenshots/staff-dashboard/desktop.png) · [Tablet](../../artifacts/lab-04/screenshots/staff-dashboard/tablet.png) · [Mobile](../../artifacts/lab-04/screenshots/staff-dashboard/mobile.png). Loading/empty/forbidden/failure behavior has additional component/API/E2E checks documented in tests.md; not every state is separately pictured here.

## Answer Part 6

**Working Actions Taken UI (10 points).** [Actions Taken component](https://github.com/cottonlnwza/toktickit/blob/feature/lab4-8-release-evidence/client/src/App.tsx) and [Lab 4 E2E flow](https://github.com/cottonlnwza/toktickit/blob/feature/lab4-8-release-evidence/e2e/lab-04/actions-taken-flow.spec.ts) demonstrate multiple Actions on a Ticket, immutable creation time, current/historical cycles, list/create/edit/reassign, `PLANNED` → `IN_PROGRESS` → `COMPLETED` or `CANCELLED`, required Result/follow-up note, invalid/inactive assignee rejection, Requester read-only restriction and protected API writes. Completed/cancelled/historical Actions cannot be edited. Backend version checks reject stale updates without partial writes. Browser flows operate through authenticated UI/API with the seeded PostgreSQL test database.

**Screenshots:** [Desktop](../../artifacts/lab-04/screenshots/actions-taken/desktop.png) · [Tablet](../../artifacts/lab-04/screenshots/actions-taken/tablet.png) · [Mobile](../../artifacts/lab-04/screenshots/actions-taken/mobile.png). They show multiple Action cards and a real field-level validation state; separate negative/race scenarios are supported by API and E2E tests rather than fabricated screenshots.

## Answer Part 7

**Working Ticket Workflow (5 points).** [Approved state matrix in the specification](https://github.com/cottonlnwza/toktickit/blob/feature/lab4-8-release-evidence/docs/lab-04/specification.md) covers `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED`; [workflow API tests](https://github.com/cottonlnwza/toktickit/blob/feature/lab4-8-release-evidence/server/tests/lab-04/ticket-workflow.api.test.ts) check allowed/rejected transitions, completed-current-cycle resolution evidence, reopen isolation, requester advisory indication, Administrator parity, and stale revision errors. [Ticket resolution E2E](https://github.com/cottonlnwza/toktickit/blob/feature/lab4-8-release-evidence/e2e/lab-04/ticket-resolution.spec.ts) provides browser-level proof. [Actions Taken audit tests](https://github.com/cottonlnwza/toktickit/blob/feature/lab4-8-release-evidence/server/tests/lab-04/actions-taken.api.test.ts) verify append-only Action events and deterministic version ordering; role-appropriate visibility is covered by backend enforcement and requester tests.

## Answer Part 8

**Working Requester Dashboard and Final Regression UI (5 points).** Requester dashboard numbers and recent/attention Tickets are limited to the authenticated Requester's Tickets; ownership is enforced by the backend rather than by filtering another user's data in the browser. Drill-downs lead to My Tickets/Detail with the documented filter intent. [Requester dashboard API tests](https://github.com/cottonlnwza/toktickit/blob/feature/lab4-8-release-evidence/server/tests/lab-04/requester-dashboard.api.test.ts) and [cross-Requester E2E](https://github.com/cottonlnwza/toktickit/blob/feature/lab4-8-release-evidence/e2e/lab-04/dashboards.spec.ts) show isolation. Lab 3 browser regression **7/7** covers authentication/password change, My Tickets/Ticket Detail and Requester continuation, Staff Queue/Detail, role authorization, and Administrator management. Labs 1–3 server/client regression suites also passed as recorded in Part 3.

**Screenshots:** [Desktop](../../artifacts/lab-04/screenshots/requester-dashboard/desktop.png) · [Tablet](../../artifacts/lab-04/screenshots/requester-dashboard/tablet.png) · [Mobile](../../artifacts/lab-04/screenshots/requester-dashboard/mobile.png).

## Answer Part 9

**Zen Green UI, Responsive, Accessibility, and Final Polish (5 points).** [Rendered Lab 4 UI specification and completed visual/accessibility checklist](https://github.com/cottonlnwza/toktickit/blob/feature/lab4-8-release-evidence/docs/lab-04/ui-spec.md). Browser checks at **1440×900 desktop, 820×1180 tablet, 390×844 mobile** verify no page-level horizontal overflow, hidden required controls or material clipping/overlap on the major screens; visible keyboard focus, field-associated validation, distinct read-only values and non-color status cues are also tested. [Visual-hardening browser tests](https://github.com/cottonlnwza/toktickit/blob/feature/lab4-8-release-evidence/e2e/lab-04/visual-hardening.spec.ts) captured all nine real screenshots below.

| Major screen | Desktop 1440×900 | Tablet 820×1180 | Mobile 390×844 |
|---|---|---|---|
| IT Staff Dashboard | [Image](../../artifacts/lab-04/screenshots/staff-dashboard/desktop.png) | [Image](../../artifacts/lab-04/screenshots/staff-dashboard/tablet.png) | [Image](../../artifacts/lab-04/screenshots/staff-dashboard/mobile.png) |
| Requester Dashboard | [Image](../../artifacts/lab-04/screenshots/requester-dashboard/desktop.png) | [Image](../../artifacts/lab-04/screenshots/requester-dashboard/tablet.png) | [Image](../../artifacts/lab-04/screenshots/requester-dashboard/mobile.png) |
| Actions Taken | [Image](../../artifacts/lab-04/screenshots/actions-taken/desktop.png) | [Image](../../artifacts/lab-04/screenshots/actions-taken/tablet.png) | [Image](../../artifacts/lab-04/screenshots/actions-taken/mobile.png) |

**Outstanding before final submission:** peer review and merge of the Issue #70 documentation/evidence PR, reviewed `lab4-staging → main` release PR and peer merge, all Lab 4 Issues shown Done in the final Kanban, final-main regression/build output, and refreshed PDF screenshots/links if release evidence changes. Do not infer these events from the current draft.
