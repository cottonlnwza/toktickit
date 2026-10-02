# Lab 4 Sprint Engineering Specification

Status: Proposed Sprint 4 engineering contract for Issue #63. This document must be peer-reviewed before implementation Issues begin.

## 1. Sprint Goal

Complete the core TokTickIT service-desk workflow by adding trackable Actions Taken, enforcing the final Ticket lifecycle and resolution gate, adding concise role-appropriate dashboards, and hardening the full Labs 1-3 application without discarding existing data or weakening existing authorization.

## 2. Stakeholder Request Interpretation

Lab 4 adds operational work records under Tickets so permitted staff can plan, assign, update, complete, and cancel work while the Ticket keeps one primary owner. Requesters can see Actions Taken on their own Tickets but cannot write them. The sprint also adds Requester and IT Staff dashboards backed by authoritative server calculations, finalizes Ticket status rules, and performs final regression, responsive, accessibility, security, and failure-state hardening across the application.

## 3. Scope

### Included

- Actions Taken on Ticket Detail, including Action Date/Time, Action Description, Result, Performed by, Follow-Up Required, conditional Follow-up Note, and Attachment Notes.
- Action assignment and Action status needed by the Lab 4 demonstration requirements.
- Requester read-only visibility of Actions Taken on owned Tickets.
- IT Staff and Administrator create/update authority for Actions Taken, enforced by the backend.
- Final Ticket status-transition matrix and server-side resolution gate.
- Requester and IT Staff dashboards; Administrator reuses the staff dashboard for Lab 4 support/testing.
- Backend dashboard calculations, empty behavior, stable ordering, and drill-down query contracts.
- Prisma migration/backfill, idempotent seed updates, stale-update protection, and retry-safe Action creation.
- Labs 1-3 regression, responsive behavior, accessibility, security, safe failures, and final product hardening.
- Required Sprint 4 documentation, tests, screenshots, peer-review evidence, and release integration.

### Explicitly Excluded

- Automatic SLA clocks, escalation engines, on-call scheduling, and breach notifications.
- Email, SMS, LINE, push, or other external notifications.
- Inventory/spare-parts consumption, purchasing, service cost accounting, billing, payroll, or labor-cost calculation.
- Multi-level approvals or electronic signatures.
- Advanced BI, custom report builders, export warehouses, multi-tenant organizations, or production-scale cloud changes.
- New product features not approved by this contract.
- Retrospective rewrites of completed Lab 3 behavior solely to fix historical Lab 3 issues. Lab 3 remains regression scope; Lab 4 changes earlier behavior only when required by an explicit Lab 4 rule.

## 4. Functional Requirements

- **FR-01:** A Ticket shall support zero, one, or many Actions Taken.
- **FR-02:** Permitted IT Staff and Administrators shall be able to create an Action Taken on an accessible Ticket.
- **FR-03:** An Action Taken shall expose backend-generated Action Date/Time, Action Description, Result, Performed by, Follow-Up Required, conditional Follow-up Note, and Attachment Notes.
- **FR-04:** An Action Taken shall support one active staff assignee and a small work-state lifecycle so the required create, assign, edit, status transition, complete, and cancel demonstrations are possible.
- **FR-05:** Permitted staff shall be able to edit non-terminal Actions Taken and reassign them only to an active IT Staff or Administrator.
- **FR-06:** Completing an Action Taken shall record the authenticated completing user as Performed by.
- **FR-07:** Requesters shall be able to read all Actions Taken on their owned Tickets but shall not create, edit, assign, transition, complete, or cancel them.
- **FR-08:** Action creation shall be retry-safe so repeated clicks/network retry do not create duplicate Actions Taken.
- **FR-09:** The backend shall enforce the final Ticket status-transition matrix even when the normal UI is bypassed.
- **FR-10:** Transitioning a Ticket to Resolved shall be rejected while any Action Taken on that Ticket remains non-terminal.
- **FR-11:** The Requester `Problem Appears Resolved` indication shall remain advisory and shall never directly change Ticket status.
- **FR-12:** Requesters shall receive a dashboard containing only metrics and recent/attention-required Ticket data for their authenticated identity.
- **FR-13:** IT Staff shall receive a dashboard containing approved operational counts, current-user Action information, and recent/urgent Ticket information.
- **FR-14:** Administrators shall be permitted to reuse the IT Staff dashboard for support/testing while retaining User Management navigation.
- **FR-15:** Dashboard metrics shall be calculated by the backend from PostgreSQL and shall provide documented zero/empty behavior and practical drill-down destinations.
- **FR-16:** All Lab 4 write operations shall enforce authentication, role authorization, ownership/access rules, CSRF/origin rules from Lab 3, validation, and safe errors on the backend.
- **FR-17:** Ticket and Action updates shall detect stale writes so one user does not silently overwrite a more recent workflow change.
- **FR-18:** The migration shall preserve all existing Users, Tickets, Attachments, Public Comments, Internal Notes, authentication state, and ownership relationships.
- **FR-19:** Seed behavior shall remain idempotent and provide zero/one/many Actions Taken plus zero/non-zero dashboard examples.
- **FR-20:** Major Lab 4 screens shall preserve the Zen Green design language and remain usable on desktop, tablet, and mobile with keyboard-visible focus and non-color cues.
- **FR-21:** Important forms shall preserve entered data after recoverable failures, and duplicate actions from repeated submission shall be prevented or safely replayed.
- **FR-22:** Final verification shall include unit, API/integration, UI component, UI style, responsive, authorization, workflow, migration/regression, performance-smoke, and E2E coverage.

## 5. Business Rules

### 5.1 Actions Taken

- **BR-01:** Every Action Taken belongs to exactly one Ticket. A Ticket may have zero or many Actions Taken.
- **BR-02:** The Ticket primary owner coordinates the Ticket, but an Action Taken assignee and the authenticated user who performs/completes the Action may be different people.
- **BR-03:** Requesters may read Actions Taken only through owned Ticket access. Requesters cannot write or transition Actions Taken.
- **BR-04:** IT Staff may create/update Actions Taken on Tickets available to the IT Staff workflow. Administrator receives the same Actions Taken behavior for Lab 4 support/testing.
- **BR-05:** `actionDateTime` is the backend creation time (`createdAt`) expressed as an ISO-8601 UTC timestamp. The client does not choose or rewrite it.
- **BR-06:** `actionDescription` is trimmed and required at 1-2000 characters. It is stored/rendered as plain text.
- **BR-07:** `result` may be empty while an Action is `PLANNED` or `IN_PROGRESS`, but transition to `COMPLETED` requires trimmed Result content of 1-2000 characters.
- **BR-08:** `followUpRequired` is required. When true, `followUpNote` is required after trimming at 1-1000 characters. When false, the persisted `followUpNote` is `null`.
- **BR-09:** `attachmentNotes` is optional plain text, trimmed to at most 1000 characters. It describes what existing/supporting file to inspect; Lab 4 does not add an inventory or attachment-billing subsystem.
- **BR-10:** An Action Taken has exactly one assignee while non-terminal. The assignee must be an active `IT_STAFF` or `ADMINISTRATOR`. Inactive or Requester assignees are rejected with a safe validation/conflict response.
- **BR-11:** On create, assignee defaults to the authenticated actor if no explicit valid assignee is supplied.
- **BR-12:** Action statuses are `PLANNED`, `IN_PROGRESS`, `COMPLETED`, and `CANCELLED`.
- **BR-13:** Allowed Action transitions are `PLANNED -> IN_PROGRESS|CANCELLED` and `IN_PROGRESS -> COMPLETED|CANCELLED`. `COMPLETED` and `CANCELLED` are terminal.
- **BR-14:** Editable content/assignee fields may be changed only while an Action is `PLANNED` or `IN_PROGRESS`. Terminal Actions are immutable through normal Lab 4 APIs.
- **BR-15:** On transition to `COMPLETED`, the backend sets `performedById` from the authenticated actor and `completedAt` from the server clock. The client cannot submit either identity/time.
- **BR-16:** On transition to `CANCELLED`, the backend records `cancelledAt` from the server clock; `performedById` remains unchanged/null unless the Action had already been completed, which is impossible because terminal states cannot transition.
- **BR-17:** Actions Taken are ordered by `createdAt asc`, then `id asc` for deterministic display. Dashboard recent-action lists use `updatedAt desc`, then `id desc`.
- **BR-18:** Action create requests require a client-generated UUID `clientRequestId` with global uniqueness. Exact replay by the same authorized actor/Ticket with the same normalized payload returns the original Action without creating a duplicate; conflicting reuse returns `409 ACTION_REPLAY_CONFLICT`.

### 5.2 Ticket status and resolution

- **BR-19:** Ticket statuses remain `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED`.
- **BR-20:** Normal Ticket status transitions remain an IT Staff operation. Lab 4 does not broaden Administrator Ticket status authority merely because Administrator may perform Actions Taken.
- **BR-21:** Final allowed Ticket transitions are:

| From | Allowed to |
|---|---|
| New | Open, Cancelled |
| Open | In Progress, Waiting for Requester, Resolved, Cancelled |
| In Progress | Waiting for Requester, Resolved, Cancelled |
| Waiting for Requester | In Progress, Resolved, Cancelled |
| Resolved | Closed, Reopened |
| Closed | Reopened |
| Reopened | In Progress, Waiting for Requester, Resolved, Cancelled |
| Cancelled | Reopened |

- **BR-22:** Transitions to `RESOLVED`, `CLOSED`, `CANCELLED`, or `REOPENED` require explicit UI confirmation; the backend validates independently.
- **BR-23:** A transition to `RESOLVED` is allowed only when every Action Taken for that Ticket is terminal (`COMPLETED` or `CANCELLED`). A Ticket with zero Actions Taken passes this specific gate because there is no incomplete Action; other transition rules still apply.
- **BR-24:** Requester `Problem Appears Resolved` remains advisory and does not satisfy, bypass, or execute the formal `RESOLVED` transition.
- **BR-25:** Ticket status change and resolution-gate evaluation occur atomically using the current persisted Action states so an incomplete Action cannot be created/left active between validation and the status update.

### 5.3 Dashboard calculations

All dashboard calculations use the authenticated identity and server-side PostgreSQL queries. `now` is server UTC. API timestamps are UTC ISO-8601; the UI formats them in the browser locale without changing calculation boundaries.

- **BR-26:** Active Ticket statuses for dashboard counts are `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, and `REOPENED`.
- **BR-27:** Requester `openTickets` = count of owned Tickets in active statuses.
- **BR-28:** Requester `waitingForRequester` = count of owned Tickets with `WAITING_FOR_REQUESTER`.
- **BR-29:** Requester `recentlyUpdated` = up to 5 owned Tickets ordered `updatedAt desc, id desc`, restricted to updates in the previous 7 * 24 hours; empty list when none match.
- **BR-30:** Requester `recentlyResolved` = up to 5 owned Tickets with a non-null `resolvedAt` in the previous 30 * 24 hours, ordered `resolvedAt desc, id desc`.
- **BR-31:** IT Staff `unassignedTickets` = active-status Tickets with `ownerId=null`.
- **BR-32:** IT Staff `myTickets` = active-status Tickets where `ownerId` equals the authenticated staff User id.
- **BR-33:** IT Staff `byStatus` returns counts for all eight Ticket statuses, including explicit zero counts.
- **BR-34:** IT Staff `byItPriority` returns active-status counts for `LOW`, `MEDIUM`, `HIGH`, and `URGENT`, including explicit zero counts.
- **BR-35:** IT Staff `recentUrgentTickets` = up to 5 active `URGENT` IT Priority Tickets ordered `updatedAt desc, id desc`.
- **BR-36:** IT Staff `myOpenActions` = count of `PLANNED` or `IN_PROGRESS` Actions assigned to the authenticated staff User.
- **BR-37:** IT Staff `myRecentActions` = up to 5 Actions where the authenticated staff User is assignee or performer, ordered `updatedAt desc, id desc`.
- **BR-38:** Administrator dashboard reuses the IT Staff dashboard contract. Additional user-account KPI cards are intentionally deferred to avoid unneeded analytics scope.
- **BR-39:** Every actionable metric/card provides a documented drill-down destination where practical. A zero metric still renders as `0`; empty recent lists render a clear empty state rather than disappearing.

### 5.4 Concurrency, failures, and preservation

- **BR-40:** Ticket and Action Taken records use integer `version` values beginning at 0. Mutable APIs require `expectedVersion`; successful mutation atomically matches the old version and increments it. A mismatch returns `409 STALE_UPDATE` with no overwrite.
- **BR-41:** Safe failures never expose stack traces, database internals, password/session secrets, storage paths, protected cross-user resource details, or Internal Note content to Requesters.
- **BR-42:** Recoverable UI failures preserve entered Action/Ticket form data. Submit buttons are disabled while the request is in flight.
- **BR-43:** Existing Public Comments and Internal Notes remain append-only. Lab 4 does not add edit/delete behavior for them.
- **BR-44:** Existing authentication, role navigation, ownership, Requester Ticket/Attachment behavior, IT Staff Queue/Detail behavior, comments/notes, and Administrator User Management remain regression requirements.
- **BR-45:** A Lab 3 defect discovered during Lab 4 verification is recorded honestly but is not repaired by rewriting a completed Lab 3 branch. Any correction required to satisfy an explicit Lab 4 requirement must be implemented as new Lab 4 work through the Lab 4 review flow.

## 6. Authorization Matrix

| Operation | Requester | IT Staff | Administrator |
|---|---|---|---|
| View Requester dashboard | Own data only | No | No |
| View IT Staff dashboard | No | Yes | Yes |
| View Actions Taken | Owned Ticket only | Accessible Ticket | Accessible Ticket |
| Create Action Taken | No | Yes | Yes |
| Edit/reassign non-terminal Action Taken | No | Yes | Yes |
| Transition/complete/cancel Action Taken | No | Yes | Yes |
| Be Action assignee | No | Active only | Active only |
| Change normal Ticket status | No | Per Ticket matrix | No |
| Indicate Problem Appears Resolved | Owned Ticket only | No | No |
| Existing Lab 3 User Management | No | No | Yes |

Frontend visibility is feedback only. Every protected operation above is re-checked by the backend.

## 7. UI Specification Summary

- Reuse the Lab 3 Zen Green tokens, typography, spacing, cards, badges, validation placement, editable/read-only styling, and responsive breakpoints. Details are in `docs/lab-04/ui-spec.md`.
- Add a role-appropriate **Dashboard** navigation item with clear active-page indication.
- IT Staff Dashboard uses concise metric cards plus recent/urgent Ticket and current-user Action lists; each actionable item links to Ticket Queue, filtered Queue, or Ticket Detail.
- Requester Dashboard shows only owned metrics and recent/attention-required Ticket cards and does not duplicate the full My Tickets screen.
- Existing Ticket Detail gains an **Actions Taken** area. Staff/Admin receive list + create/edit/status controls; Requester receives read-only list on owned Tickets.
- Action create/edit uses field-level validation and visibly distinguishes assignee, status, server-generated Action Date/Time, and server-derived Performed by.
- Loading, saving, success, empty/no-results, forbidden, not-found, conflict/stale, and safe API-failure feedback is provided where meaningful.
- No page-level horizontal scrolling; keyboard focus remains visible; icons do not replace necessary text/labels.

## 8. Data Changes

### 8.1 `ActionTaken` model contract

Planned Prisma-level fields:

| Field | Contract |
|---|---|
| `id` | `Int @id @default(autoincrement())` |
| `ticketId` | Required FK to `Ticket`, `onDelete: Restrict` |
| `clientRequestId` | Required globally unique UUID string for retry-safe create |
| `actionDescription` | Required string, 1-2000 trimmed chars |
| `result` | Nullable until completion; 1-2000 trimmed chars when present/required |
| `status` | `ActionStatus`, default `PLANNED` |
| `assigneeId` | Required FK to active IT Staff/Administrator User |
| `performedById` | Nullable FK; backend set on completion |
| `followUpRequired` | Required Boolean |
| `followUpNote` | Nullable; required 1-1000 chars when follow-up is true |
| `attachmentNotes` | Nullable; max 1000 chars |
| `completedAt` | Nullable server timestamp |
| `cancelledAt` | Nullable server timestamp |
| `version` | `Int @default(0)` optimistic concurrency token |
| `createdAt` | Backend timestamp; displayed as Action Date/Time |
| `updatedAt` | `@updatedAt` |

Relationships added to `Ticket` and `User` are named explicitly to distinguish Action assignee and performer relationships.

Indexes:

- `@@index([ticketId, createdAt, id])` for Ticket Detail stable Action ordering.
- `@@index([assigneeId, status, updatedAt])` for current-user Action dashboard queries.
- `@@index([performedById, updatedAt])` for recent performed Actions.
- Unique `clientRequestId` for retry-safe creation.

### 8.2 Ticket additions

- `version Int @default(0)` for stale Ticket workflow mutation detection.
- `resolvedAt DateTime?` maintained by formal status transitions. Entering `RESOLVED` sets server time. Reopening clears it only for the new active lifecycle; a later resolve sets a new value.
- Index `@@index([requesterId, resolvedAt])` supports the Requester recently-resolved dashboard query.

### 8.3 Migration and backfill

- Migration adds new nullable/with-safe-default columns first, creates `ActionTaken`, indexes, and enum, backfills required values, then applies final constraints where necessary.
- Existing Tickets receive `version=0`.
- Existing Tickets currently `RESOLVED` or `CLOSED` receive `resolvedAt=updatedAt` as a documented legacy approximation because Labs 1-3 did not persist a resolution timestamp; other existing Tickets receive `resolvedAt=null`.
- Existing Users/Tickets/Attachments/Public Comments/Internal Notes are not recreated, renumbered, or deleted.
- Recovery approach: restore the pre-migration database backup for destructive migration failure in local lab use; schema deployment itself remains forward-only. The integration test verifies preservation/backfill on a Lab 3-shaped fixture database before release.

### 8.4 Seed decisions

- Seed remains idempotent through deterministic lookup/upsert keys.
- Seed covers all major Ticket statuses/priorities and assigned/unassigned Ticket ownership.
- Seed includes Tickets with zero, one, and multiple Actions Taken.
- Seed includes non-terminal, completed, and cancelled Actions assigned across active staff.
- Seed includes data that makes selected dashboard metrics non-zero plus at least one User/Ticket fixture producing zero/empty dashboard states.

### 8.5 Database design justifications

1. **Optimistic version fields instead of last-write-wins:** Ticket/Action mutations are low-volume interactive writes where a small integer compare-and-increment prevents silent overwrites without holding long-lived locks across browser requests.
2. **Persist `resolvedAt` instead of deriving “recently resolved” from `updatedAt`:** comments, notes, attachments, or later metadata can change `updatedAt`; a dedicated resolution timestamp makes the dashboard calculation authoritative and stable.
3. **Globally unique Action `clientRequestId`:** repeated browser/network submissions can safely replay one creation without duplicating operational work records.

## 9. API Contract Summary

Exact request/response shapes and errors are in `docs/lab-04/api-spec.md`.

- Actions Taken: shared read plus staff/admin create, edit, and status-transition endpoints under the Ticket resource.
- Dashboards: `GET /api/dashboards/requester` and `GET /api/dashboards/staff`.
- Ticket status update keeps the existing Lab 3 endpoint but adds `expectedVersion` and the Lab 4 resolution gate.
- Existing Labs 2-3 APIs remain available according to existing authorization and ownership rules.
- Lab 4 uses the existing authenticated session/CSRF/origin mechanism; no new authentication system is introduced.

## 10. Acceptance Criteria

- **AC-01:** Given permitted IT Staff/Admin and valid data, when an Action Taken is created, then exactly one Action is stored under the correct Ticket with backend creation time, approved assignee, retry key, and version 0.
- **AC-02:** Given an Action create request is retried with the same request id and normalized payload, when the backend receives it again, then the original Action is returned without a duplicate; conflicting reuse returns 409.
- **AC-03:** Given a Requester, when Actions Taken are requested for an owned Ticket, then all permitted Action records are readable; writing any Action is rejected.
- **AC-04:** Given a non-terminal Action, when permitted staff edits/reassigns it, then validation and active-assignee rules are enforced and stale expectedVersion is rejected without overwrite.
- **AC-05:** Given an Action in `PLANNED`, when permitted staff transitions it, then only `IN_PROGRESS` or `CANCELLED` is accepted.
- **AC-06:** Given an Action in `IN_PROGRESS`, when completion is requested with a valid Result, then status becomes `COMPLETED` and backend sets `performedBy`/`completedAt`; missing Result is rejected.
- **AC-07:** Given `followUpRequired=true`, when Follow-up Note is blank, then create/update is rejected with field-level validation; when false, stored Follow-up Note is null.
- **AC-08:** Given a Ticket with one or more non-terminal Actions, when IT Staff requests `RESOLVED`, then the backend rejects the transition even if the UI is bypassed.
- **AC-09:** Given a Ticket with zero Actions or only terminal Actions and an otherwise permitted transition, when IT Staff requests `RESOLVED`, then the transition is allowed and `resolvedAt` is set from the server clock.
- **AC-10:** Given an authenticated Requester, when dashboard data is retrieved, then counts/lists include only owned Tickets and match BR-27 through BR-30.
- **AC-11:** Given authenticated IT Staff, when dashboard data is retrieved, then operational metrics and current-user Action data match BR-31 through BR-37 and include explicit zero/empty values.
- **AC-12:** Given an Administrator, when the staff dashboard is requested, then the same support/testing dashboard contract is available without removing Administrator User Management access.
- **AC-13:** Given a dashboard actionable card/list item, when activated, then it opens the documented Queue/My Tickets/Ticket Detail drill-down with matching filter intent.
- **AC-14:** Given concurrent Ticket/Action edits, when a stale expectedVersion is submitted, then the operation returns safe `409 STALE_UPDATE` and the newer persisted data is not overwritten.
- **AC-15:** Given the Lab 3 database state, when the Lab 4 migration runs, then all existing Users/Tickets/Attachments/Comments/Notes and relationships remain valid, new fields are backfilled as specified, and legacy Resolved/Closed Tickets receive the documented `resolvedAt` approximation.
- **AC-16:** Given the Lab 4 seed runs repeatedly, then required Ticket/Action/dashboard fixtures exist without accumulating duplicates.
- **AC-17:** Given repeated clicks or recoverable API/network failures, when a Lab 4 form retries, then duplicate Actions are prevented and entered data is preserved where recovery is possible.
- **AC-18:** Given any major Lab 4 screen on desktop/tablet/mobile, when rendered and operated by keyboard, then required controls remain visible/usable with no material clipping, overlap, or page-level horizontal overflow.
- **AC-19:** Given the final Lab 4 integrated state, when representative Labs 1-3 regression tests run, then actual results are recorded without rewriting completed Lab 3 history; any Lab 4-required correction follows the Lab 4 branch/review flow.
- **AC-20:** Given final verification, when required unit/API/integration/UI/style/responsive/authorization/workflow/migration/regression/performance-smoke/E2E suites run, then `tests.md` traceability and final statuses match actual repository evidence.

Every Acceptance Criterion maps to at least one planned test in `docs/lab-04/tests.md`.

## 11. Definition of Done

### Product completion

- [ ] All approved Lab 4 scope is implemented without unapproved feature expansion.
- [ ] Every AC is satisfied and traceable to planned/actual evidence.
- [ ] Required automated tests pass from documented commands; required tests are not skipped/disabled to claim completion.
- [ ] Actions Taken model/API/UI, final Ticket workflow, resolution gate, dashboards, migration/backfill, and stale-update behavior match this contract.
- [ ] Dashboard metrics selected for evidence match direct database queries.
- [ ] Existing authentication, authorization, Requester, IT Staff, Administrator, comments, notes, and Attachment behavior remains regression-covered.
- [ ] Major Lab 4 screens satisfy Zen Green, responsive, and accessibility rules.
- [ ] Recoverable failures preserve important form input and duplicate writes are prevented/safely replayed.
- [ ] Console errors, broken links, placeholder text, and unfinished Lab 4 controls are removed before release.
- [ ] README setup, seed, migration, test, and demonstration instructions are current before release.

### Course delivery

- [ ] Lab 4 Issues use Backlog -> Specified -> Started -> PR Review -> Fixing (when needed) -> PR Review -> Done.
- [ ] Each implementation Issue uses its own feature branch and reviewed PR into `lab4-staging`.
- [ ] The student does not self-approve or self-merge feature PRs; peer review/merge is recorded in `reviewer.md`.
- [ ] Final release uses a reviewed `lab4-staging` -> `main` PR.
- [ ] Final GitHub Project/Kanban shows Lab 4 Issues in Done only after required review/merge.
- [ ] Required docs, test outputs, screenshots, repository evidence, and Answer Part 1-9 PDF evidence are complete and readable.

## 12. Assumptions and Decisions

- **AD-01:** Page 6 of the Lab 4 handout clarifies Action Date/Time as Action create date/time, so it is backend-generated `createdAt`, not an arbitrary client-editable timestamp.
- **AD-02:** The submission requirement to demonstrate assign/edit/status transition/complete/cancel is implemented with `assigneeId` plus the minimal four-state Action lifecycle `PLANNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.
- **AD-03:** `performedById` is assigned by the backend when work is completed; this keeps “Performed by (auto)” truthful even when creator, assignee, and actual completing staff member differ.
- **AD-04:** Cancelled Actions are terminal and do not block Ticket resolution because they no longer represent incomplete work.
- **AD-05:** Zero Actions Taken do not by themselves block Ticket resolution; the handout defers the rule that incomplete Actions block resolution, not a rule requiring at least one Action.
- **AD-06:** Administrator receives full Actions Taken behavior as explicitly required in Lab 4 but does not gain normal Ticket status-transition authority; this preserves Lab 3's separation of Administrator and IT Staff Ticket workflow except where Lab 4 explicitly extends Administrator behavior.
- **AD-07:** Dashboard rolling windows are UTC server-time windows of 7 days for recently updated and 30 days for recently resolved. UI formatting may localize timestamps, but calculation boundaries stay server-authoritative.
- **AD-08:** Administrator reuses the IT Staff dashboard without extra account KPIs to keep analytics concise and inside required scope.
- **AD-09:** Existing Project #3 is reused for Lab 4 because it already contains the required Kanban statuses and prior individual sprint history; Lab 4 Issues are added as new items.
- **AD-10:** Findings that are purely historical Lab 3 defects are not fixed by modifying old Lab 3 branches. If an explicit Lab 4 requirement cannot be met without changing shared code, that change is new Lab 4 work and must be reviewed in the relevant Lab 4 Issue.
