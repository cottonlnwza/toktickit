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
- **FR-03:** An Action Taken shall expose Action create Date/Time, Action Description, Result, Performed by (auto), Follow-Up Required, conditional Follow-up Note, and Attachment Notes. Action create Date/Time is an immutable server audit timestamp, not a backdated occurrence-time field.
- **FR-04:** An Action Taken shall support one active staff assignee and a small work-state lifecycle so the required create, assign, edit, status transition, complete, and cancel demonstrations are possible.
- **FR-05:** Permitted staff shall be able to edit non-terminal Actions Taken and reassign them only to an active IT Staff or Administrator.
- **FR-06:** Completing an Action Taken shall record the authenticated completing user as Performed by, and completion is permitted only when that user is the current Action assignee; another permitted staff member must reassign the Action before completing it.
- **FR-07:** Requesters shall be able to read all Actions Taken on their owned Tickets but shall not create, edit, assign, transition, complete, or cancel them.
- **FR-08:** Action creation shall be retry-safe so repeated clicks/network retry do not create duplicate Actions Taken.
- **FR-09:** The backend shall enforce the final Ticket status-transition matrix even when the normal UI is bypassed.
- **FR-10:** Transitioning a Ticket to Resolved shall be rejected unless the current workflow cycle contains at least one valid `COMPLETED` Action and contains no `PLANNED` or `IN_PROGRESS` Action.
- **FR-11:** The Requester `Problem Appears Resolved` indication shall remain advisory and shall never directly change Ticket status.
- **FR-12:** Requesters shall receive a dashboard containing only metrics and recent/attention-required Ticket data for their authenticated identity.
- **FR-13:** IT Staff shall receive a dashboard containing approved operational counts, current-user Action information, and recent/urgent Ticket information.
- **FR-14:** Administrators shall be permitted to reuse IT Staff Lab 4 behavior for support/testing, including the staff dashboard, Actions Taken, and the same final Ticket status transitions, while retaining User Management navigation.
- **FR-15:** Dashboard metrics shall be calculated by the backend from PostgreSQL and shall provide documented zero/empty behavior and practical drill-down destinations.
- **FR-16:** All Lab 4 write operations shall enforce authentication, role authorization, ownership/access rules, CSRF/origin rules from Lab 3, validation, and safe errors on the backend.
- **FR-17:** Ticket and Action aggregate updates shall detect stale writes across both the child Action and parent Ticket revision so one user does not silently overwrite a more recent workflow or Action change.
- **FR-18:** The migration shall preserve all existing Users, Tickets, Attachments, Public Comments, Internal Notes, authentication state, and ownership relationships.
- **FR-19:** Seed behavior shall remain idempotent and provide zero/one/many Actions Taken plus zero/non-zero dashboard examples.
- **FR-20:** Major Lab 4 screens shall preserve the Zen Green design language and remain usable on desktop, tablet, and mobile with keyboard-visible focus and non-color cues.
- **FR-21:** Important forms shall preserve entered data after recoverable failures, and duplicate actions from repeated submission shall be prevented or safely replayed.
- **FR-22:** Every Action create/edit/reassign/start/complete/cancel mutation shall append an immutable Action event that records actor, event type, resulting Action/Ticket revisions, and relevant status/assignee change metadata.
- **FR-23:** Final verification shall include unit, API/integration, UI component, UI style, responsive, authorization, workflow, migration/regression, performance-smoke, and E2E coverage.

## 5. Business Rules

### 5.1 Actions Taken

- **BR-01:** Every Action Taken belongs to exactly one Ticket and exactly one Ticket `workflowCycle`. A Ticket may have zero or many historical Actions Taken across cycles.
- **BR-02:** The Ticket primary owner coordinates the Ticket, but an Action may be assigned to a different active IT Staff or Administrator. The assignee is the accountable person for that Action, not an advisory label.
- **BR-03:** Requesters may read Actions Taken only through owned Ticket access. Requesters cannot write or transition Actions Taken.
- **BR-04:** IT Staff and Administrators may create/update Actions Taken on accessible Tickets while the parent Ticket is in an active workflow status (`NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `REOPENED`). Actions on `RESOLVED`, `CLOSED`, or `CANCELLED` Tickets are historical/read-only until the Ticket is reopened into a new cycle.
- **BR-05:** `actionDateTime` is the immutable backend `createdAt` timestamp expressed as ISO-8601 UTC. This follows the handout wording “Action create date/time”; Lab 4 does not invent a separate backdated work-occurrence field.
- **BR-06:** `actionDescription` is trimmed and required at 1-2000 characters. It is stored/rendered as plain text.
- **BR-07:** `result` may be empty while an Action is `PLANNED` or `IN_PROGRESS`, but transition to `COMPLETED` requires trimmed Result content of 1-2000 characters.
- **BR-08:** `followUpRequired` is required. When true, `followUpNote` is required after trimming at 1-1000 characters. When false, persisted `followUpNote` is `null`. `followUpRequired` is descriptive/planning evidence and does not by itself block Ticket resolution once the Action is completed.
- **BR-09:** `attachmentNotes` is optional plain text, trimmed to at most 1000 characters. It describes what existing/supporting file to inspect; Lab 4 does not add a new attachment subsystem.
- **BR-10:** A non-terminal Action has exactly one assignee. The assignee must be an active `IT_STAFF` or `ADMINISTRATOR`. Inactive or Requester assignees are rejected with `409 INACTIVE_ASSIGNEE`.
- **BR-11:** On create, assignee defaults to the authenticated actor if no explicit valid assignee is supplied. `createdById` is always the authenticated actor and is immutable audit data.
- **BR-12:** Action statuses are `PLANNED`, `IN_PROGRESS`, `COMPLETED`, and `CANCELLED`.
- **BR-13:** Allowed Action transitions are `PLANNED -> IN_PROGRESS|COMPLETED|CANCELLED` and `IN_PROGRESS -> COMPLETED|CANCELLED`. Direct `PLANNED -> COMPLETED` is allowed so a one-step task can be recorded without a ceremonial Start action; completion validation and assignee-only rules still apply. `COMPLETED` and `CANCELLED` are terminal.
- **BR-14:** Editable content/assignee fields may be changed only while an Action is `PLANNED` or `IN_PROGRESS`. Terminal Actions are immutable through normal Lab 4 APIs.
- **BR-15:** Only the current Action assignee may transition that Action to `COMPLETED`. On completion, the backend verifies `authenticatedUser.id == assigneeId`, sets `performedById` to that authenticated assignee, and sets `completedAt` from the server clock. A different staff member must first reassign the Action through an authorized mutation.
- **BR-16:** Any permitted IT Staff/Administrator may cancel an accessible non-terminal Action. The backend sets `cancelledAt` from the server clock; cancellation actor is captured by the append-only Action event.
- **BR-17:** Ticket Detail Actions are ordered by `workflowCycle asc`, `createdAt asc`, then `id asc`. The current cycle is visually identified; historical cycles remain readable. Dashboard current-work lists use only the Ticket's current cycle.
- **BR-18:** Action create requests require a client-generated globally unique UUID `clientRequestId`. Database uniqueness is global. Replay authorization first applies normal Ticket/resource visibility. If the UUID exists only in a Ticket/resource the caller is not permitted to discover, the response is protected `404 NOT_FOUND`. Only after the existing Action is within the caller's authorized context does the backend compare original `ticketId`, `createdById`, and immutable `createFingerprint` computed from normalized original create intent. Edits never change that fingerprint. Exact replay returns the original Action; authorized-context conflicting reuse returns `409 ACTION_REPLAY_CONFLICT`.
- **BR-19:** Every successful Action mutation appends exactly one immutable `ActionTakenEvent`. Event types are `CREATED`, `UPDATED`, `STARTED`, `COMPLETED`, and `CANCELLED`. A single PATCH that edits content and reassigns the Action creates one `UPDATED` event whose `changedFields` includes every changed field and whose assignee snapshots capture the reassignment. `CREATED` uses resulting `actionVersion=0`; every later successful mutation uses the resulting incremented Action version. `@@unique([actionTakenId, actionVersion])` prevents more than one event for the same resulting Action revision. Canonical event order is `actionVersion asc`, then `id asc`. Exact create replay is read-only and appends no event; rejected validation, authorization, stale, or domain-conflict requests append no event and change no projection. Events are append-only audit evidence and are not edited/deleted by normal APIs.

### 5.2 Ticket status and resolution

- **BR-20:** Ticket statuses remain `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED`.
- **BR-21:** In Lab 4, both `IT_STAFF` and `ADMINISTRATOR` may perform the final Ticket status transitions below on accessible Tickets. This is an explicit Lab 4 extension because the handout says Administrator may “Perform IT Staff behavior” for support/testing; it does not rewrite completed Lab 3 branches.
- **BR-22:** Final allowed Ticket transitions are:

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

- **BR-23:** Transitions to `RESOLVED`, `CLOSED`, `CANCELLED`, or `REOPENED` require explicit UI confirmation; the backend validates independently.
- **BR-24:** A Ticket has integer `workflowCycle` beginning at 1. Every Action copies the Ticket's current cycle at creation. Successful transition to `REOPENED` atomically increments `workflowCycle` before new work is created, so old-cycle Actions remain history and cannot satisfy or block the new cycle.
- **BR-25:** A transition to `RESOLVED` is allowed only when the Ticket's **current workflow cycle** contains at least one `COMPLETED` Action and contains zero `PLANNED` or `IN_PROGRESS` Actions. `CANCELLED` Actions neither satisfy the required completed-work evidence nor block resolution. Therefore zero Actions and cancelled-only Actions fail the resolution gate.
- **BR-26:** Requester `Problem Appears Resolved` remains advisory and does not satisfy, bypass, or execute the formal `RESOLVED` transition.
- **BR-27:** Ticket status changes, workflow-cycle changes, and resolution-gate evaluation are atomic against current persisted Action state. A concurrent Action create/update/status mutation cannot slip between the gate check and Ticket transition.

### 5.3 Dashboard calculations

All dashboard calculations capture one `generatedAt` server-UTC instant per response. Rolling-window lower bounds are inclusive (`timestamp >= cutoff`) and the upper bound is inclusive of the captured snapshot (`timestamp <= generatedAt`). API timestamps are UTC ISO-8601; UI locale formatting does not change calculation boundaries.

- **BR-28:** Active Ticket statuses are `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, and `REOPENED`.
- **BR-29:** Requester `openTickets` = count of owned Tickets in active statuses.
- **BR-30:** Requester `waitingForRequester` = count of owned Tickets with `WAITING_FOR_REQUESTER`.
- **BR-31:** Requester `recentlyUpdated` = up to 5 owned Tickets with `updatedAt >= generatedAt - 7 days` and `updatedAt <= generatedAt`, ordered `updatedAt desc, id desc`. Seven days is a project decision, not a handout-mandated value; it represents one operational week of recent activity while keeping the dashboard concise.
- **BR-32:** Requester `recentlyResolved` = up to 5 owned Tickets with `resolvedAt >= generatedAt - 30 days` and `resolvedAt <= generatedAt`, ordered `resolvedAt desc, id desc`. Thirty days is a project decision, not a handout-mandated value; it provides a one-month post-resolution reference window without turning the dashboard into report history.
- **BR-33:** IT Staff/Admin `unassignedTickets` = active-status Tickets with `ownerId=null`.
- **BR-34:** IT Staff/Admin `myTickets` = active-status Tickets where `ownerId` equals the authenticated User id.
- **BR-35:** IT Staff/Admin `byStatus` returns counts for all eight Ticket statuses, including explicit zero counts.
- **BR-36:** IT Staff/Admin `byItPriority` returns active-status counts for `LOW`, `MEDIUM`, `HIGH`, and `URGENT`, including explicit zero counts.
- **BR-37:** `recentUrgentTickets` = up to 5 active `URGENT` IT Priority Tickets ordered `updatedAt desc, id desc`.
- **BR-38:** `myOpenActions` = count of `PLANNED` or `IN_PROGRESS` Actions assigned to the authenticated User **only when** the parent Ticket is active and the Action `workflowCycle` equals the Ticket's current `workflowCycle`.
- **BR-39:** `myRecentActions` = up to 5 current-cycle Actions on active parent Tickets where the authenticated User is the current assignee **or** `performedById` equals the authenticated User, ordered `updatedAt desc, id desc`. `createdById` alone does not qualify because creation without assignment/performance is not current operational involvement. Historical Actions on terminal Tickets or earlier cycles remain available on Ticket Detail but do not appear as current dashboard work.
- **BR-40:** Administrator dashboard reuses the IT Staff dashboard contract. Additional user-account KPI cards are intentionally deferred to avoid unneeded analytics scope.
- **BR-41:** Every actionable metric/card provides a documented drill-down destination where practical. A zero metric renders as `0`; empty recent lists render a clear empty state rather than disappearing.

### 5.4 Concurrency, failures, and preservation

- **BR-42:** Ticket and Action Taken records use integer `version` values beginning at 0. The Ticket version is the aggregate revision for status/owner/priority/Action changes.
- **BR-43:** Every Action aggregate write (create, edit, reassign, start, complete, cancel) requires `expectedTicketVersion`; edits/status transitions also require `expectedActionVersion`. The transaction first compare-and-increments the Ticket version, then validates/compare-and-increments the Action version where applicable, then writes the append-only Action event. Any mismatch returns `409 STALE_UPDATE` with no partial write. Exact idempotent create replay is read-only and does not increment versions again.
- **BR-44:** Deterministic failure taxonomy: `400 VALIDATION_ERROR` for malformed/unknown fields, invalid enum values, or missing/invalid required content such as completion Result; `403 FORBIDDEN` for role authorization; protected `404 NOT_FOUND` for missing/ownership-hidden resources; `409` for validly shaped requests that conflict with current domain state (`STALE_UPDATE`, `ACTION_REPLAY_CONFLICT`, `INACTIVE_ASSIGNEE`, `ACTION_TERMINAL`, `ACTION_TRANSITION_NOT_ALLOWED`, `ACTION_ASSIGNEE_MISMATCH`, `PARENT_TICKET_NOT_ACTIVE`, `RESOLUTION_GATE_BLOCKED`).
- **BR-45:** Safe failures never expose stack traces, database internals, password/session secrets, storage paths, protected cross-user resource details, or Internal Note content to Requesters.
- **BR-46:** Recoverable UI failures preserve entered Action/Ticket form data. Submit buttons are disabled while the request is in flight.
- **BR-47:** Existing Public Comments and Internal Notes remain append-only. Lab 4 does not add edit/delete behavior for them.
- **BR-48:** Existing authentication, role navigation, ownership, Requester Ticket/Attachment behavior, IT Staff Queue/Detail behavior, comments/notes, and Administrator User Management remain regression requirements.
- **BR-49:** A Lab 3 defect discovered during Lab 4 verification is recorded honestly but is not repaired by rewriting a completed Lab 3 branch. Any correction required to satisfy an explicit Lab 4 requirement is implemented as new Lab 4 work through the Lab 4 review flow.

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
| Change final Ticket status | No | Per Ticket matrix | Per Ticket matrix (Lab 4 support/testing) |
| Indicate Problem Appears Resolved | Owned Ticket only | No | No |
| Existing Lab 3 User Management | No | No | Yes |

Frontend visibility is feedback only. Every protected operation above is re-checked by the backend.

## 7. UI Specification Summary

- Reuse the Lab 3 Zen Green tokens, typography, spacing, cards, badges, validation placement, editable/read-only styling, and responsive breakpoints. Details are in `docs/lab-04/ui-spec.md`.
- Add a role-appropriate **Dashboard** navigation item with clear active-page indication.
- IT Staff Dashboard uses concise metric cards plus recent/urgent Ticket and current-user Action lists; each actionable item links to Ticket Queue, filtered Queue, or Ticket Detail.
- Requester Dashboard shows only owned metrics and recent/attention-required Ticket cards and does not duplicate the full My Tickets screen.
- Existing Ticket Detail gains an **Actions Taken** area. Staff/Admin receive list + create/edit/status controls; Requester receives read-only list on owned Tickets.
- Action create/edit uses field-level validation and visibly distinguishes assignee, workflow cycle, status, immutable server Action create Date/Time, and server-derived Performed by. Completion is available only to the current assignee; other permitted staff must reassign first.
- Loading, saving, success, empty/no-results, forbidden, not-found, conflict/stale, and safe API-failure feedback is provided where meaningful.
- No page-level horizontal scrolling; keyboard focus remains visible; icons do not replace necessary text/labels.

## 8. Data Changes

### 8.1 `ActionTaken` model contract

Planned Prisma-level fields:

| Field | Contract |
|---|---|
| `id` | `Int @id @default(autoincrement())` |
| `ticketId` | Required FK to `Ticket`, `onDelete: Restrict` |
| `workflowCycle` | Required positive Int copied from parent Ticket at create |
| `clientRequestId` | Required globally unique UUID string for retry-safe create |
| `createFingerprint` | Required immutable hash/string of normalized original create intent |
| `createdById` | Required FK; authenticated creator, immutable |
| `actionDescription` | Required string, 1-2000 trimmed chars |
| `result` | Nullable until completion; 1-2000 trimmed chars when present/required |
| `status` | `ActionStatus`, default `PLANNED` |
| `assigneeId` | Required FK to active IT Staff/Administrator User |
| `performedById` | Nullable FK; backend set only when assignee completes |
| `followUpRequired` | Required Boolean |
| `followUpNote` | Nullable; required 1-1000 chars when follow-up is true |
| `attachmentNotes` | Nullable; max 1000 chars |
| `completedAt` | Nullable server timestamp |
| `cancelledAt` | Nullable server timestamp |
| `version` | `Int @default(0)` optimistic concurrency token |
| `createdAt` | Immutable backend Action create date/time |
| `updatedAt` | `@updatedAt` |

Relationships to `Ticket`/`User` use explicit names for creator, assignee, and performer.

Indexes:

- `@@index([ticketId, workflowCycle, createdAt, id])` for stable cycle-aware Ticket Detail ordering.
- `@@index([assigneeId, status, updatedAt])` for current-user Action dashboard queries.
- `@@index([performedById, updatedAt])` for recent performed Actions.
- Unique `clientRequestId` for globally retry-safe creation.

### 8.2 `ActionTakenEvent` append-only audit model

| Field | Contract |
|---|---|
| `id` | `Int @id @default(autoincrement())` |
| `actionTakenId` | Required FK to Action Taken |
| `ticketId` | Required FK to Ticket for audit query |
| `workflowCycle` | Required cycle snapshot |
| `eventType` | Enum: `CREATED`, `UPDATED`, `STARTED`, `COMPLETED`, `CANCELLED` |
| `actorId` | Required authenticated User FK |
| `fromStatus` / `toStatus` | Nullable status snapshots where applicable |
| `fromAssigneeId` / `toAssigneeId` | Nullable assignee snapshots where applicable |
| `actionVersion` | Resulting Action revision |
| `ticketVersion` | Resulting aggregate Ticket revision |
| `changedFields` | Optional JSON/string array of changed field names, not a mutable projection |

Invariant: `@@unique([actionTakenId, actionVersion])`; canonical history order is `actionVersion asc, id asc`. A combined edit+reassign PATCH emits one `UPDATED` event containing all changed fields plus assignee snapshots. Exact create replay and every failed/rejected/stale mutation emit no event.
| `createdAt` | Server timestamp; immutable |

Normal APIs never update/delete events. The mutable `ActionTaken` row is the current projection; events provide actor/change-sequence evidence for auditability.

### 8.3 Ticket additions

- `version Int @default(0)` as aggregate revision for Ticket and Action writes.
- `workflowCycle Int @default(1)`; increment atomically when entering `REOPENED`.
- `resolvedAt DateTime?` maintained by formal status transitions. Entering `RESOLVED` sets server time. Reopening clears current `resolvedAt`; later resolution writes a new value.
- Index `@@index([requesterId, resolvedAt])` supports recently-resolved queries.

### 8.4 Migration and backfill

- Add Ticket `version=0`, `workflowCycle=1`, and nullable `resolvedAt`; create Action/Event schema and indexes without recreating earlier rows.
- Existing `RESOLVED` or `CLOSED` Tickets receive `resolvedAt=updatedAt` as a documented legacy approximation because Labs 1-3 did not persist resolution time; others receive `null`.
- Legacy Tickets have no Actions, which is valid historical data. They do **not** automatically satisfy the new Lab 4 resolution gate if reopened: after reopening into cycle 2, that current cycle must produce at least one completed Action before resolving again.
- Existing Users/Tickets/Attachments/Public Comments/Internal Notes are not recreated, renumbered, or deleted.
- Recovery approach: restore the pre-migration database backup for destructive local migration failure; schema deployment remains forward-only. Migration integration tests verify preservation/backfill from a Lab 3-shaped fixture database.

### 8.5 Seed decisions

- Seed remains idempotent through deterministic lookup/upsert keys.
- Seed covers all major Ticket statuses/priorities and assigned/unassigned ownership.
- Seed includes Tickets with zero, one, and multiple Actions across at least two workflow cycles.
- Seed includes non-terminal, completed, and cancelled Actions assigned across active staff plus corresponding Action events.
- Seed includes active-parent current-cycle Action fixtures and historical/terminal-parent fixtures so dashboard inclusion/exclusion is demonstrable.
- Seed includes data that makes selected dashboard metrics non-zero plus at least one User/Ticket fixture producing zero/empty dashboard states.

### 8.6 Database design justifications

1. **Ticket aggregate version plus Action version:** Action writes can depend on parent status/cycle/ownership; requiring both child and parent revisions prevents a client from editing against stale aggregate state.
2. **Explicit workflow cycle:** Reopen starts new operational work while preserving old Actions as history; cycle scoping prevents old completed work from satisfying a new resolution and prevents historical work from polluting current dashboard metrics.
3. **Append-only Action events plus mutable projection:** current reads stay simple while actor/reassignment/status sequence remains auditable.
4. **Persist `resolvedAt`:** comments/notes/attachments or Action changes can alter `updatedAt`; dedicated resolution time makes recently-resolved metrics authoritative.
5. **Global retry UUID plus immutable create fingerprint:** database uniqueness prevents duplicate creates globally, while the fingerprint lets the original create replay after later edits without comparing against mutable current Action values.

## 9. API Contract Summary

Exact request/response shapes and errors are in `docs/lab-04/api-spec.md`.

- Actions Taken: shared read plus staff/admin create, edit, and status-transition endpoints under the Ticket resource.
- Dashboards: `GET /api/dashboards/requester` and `GET /api/dashboards/staff`.
- Ticket status update keeps the existing Lab 3 endpoint but adds aggregate `expectedTicketVersion`, workflow-cycle handling, and the Lab 4 resolution gate.
- Action aggregate writes require `expectedTicketVersion`; Action edit/status writes additionally require `expectedActionVersion`.
- Existing Labs 2-3 APIs remain available according to existing authorization and ownership rules.
- Lab 4 uses the existing authenticated session/CSRF/origin mechanism; no new authentication system is introduced.

## 10. Acceptance Criteria

- **AC-01:** Given permitted IT Staff/Admin and valid data on an active parent Ticket, when an Action is created with matching `expectedTicketVersion`, then exactly one current-cycle Action is stored with immutable creator, create fingerprint, server create time, approved assignee, Action version 0, incremented Ticket version, and a `CREATED` audit event.
- **AC-02:** Given the same global `clientRequestId`, when the original authorized creator retries the same normalized create intent after the Action may have been edited, then the immutable create fingerprint permits replay of the original Action without duplicate/version increment; any other reuse returns 409 without protected-data disclosure.
- **AC-03:** Given a Requester, when Actions are requested for an owned Ticket, then Actions across cycles are readable; writing any Action is rejected.
- **AC-04:** Given a non-terminal current-cycle Action, when permitted staff edits/reassigns it with matching Action/Ticket revisions, then validation and active-assignee rules are enforced, both revisions advance as contracted, and an audit event records the actor/change; stale parent or child revision is rejected without partial write.
- **AC-05:** Given a `PLANNED` Action, when permitted staff transitions it, then `IN_PROGRESS`, `COMPLETED`, or `CANCELLED` is accepted as contracted; direct completion still requires current-assignee and valid Result checks, and an immutable event records the transition.
- **AC-06:** Given a `PLANNED` or `IN_PROGRESS` Action, when the **current assignee** completes it with valid Result and matching revisions, then status becomes `COMPLETED`, `performedBy` equals that assignee, timestamps/revisions are set, and a `COMPLETED` event is appended; a non-assignee completion is rejected until reassignment.
- **AC-07:** Given `followUpRequired=true`, when Follow-up Note is blank, then create/update is rejected with `400 VALIDATION_ERROR`; when false, stored Follow-up Note is null. A completed Action with follow-up metadata does not itself block Ticket resolution; any blocking follow-up work must be a separate current-cycle non-terminal Action.
- **AC-08:** Given a Ticket current cycle with zero completed Actions, only cancelled Actions, or any `PLANNED`/`IN_PROGRESS` Action, when IT Staff/Admin requests `RESOLVED`, then backend returns `409 RESOLUTION_GATE_BLOCKED` and the Ticket remains unchanged.
- **AC-09:** Given a Ticket current cycle with at least one `COMPLETED` Action and zero `PLANNED`/`IN_PROGRESS` Actions, when IT Staff/Admin requests an otherwise permitted `RESOLVED` transition with matching aggregate revision, then it succeeds and sets `resolvedAt`.
- **AC-10:** Given a resolved/closed/cancelled Ticket, when an authorized `REOPENED` transition succeeds, then `workflowCycle` increments atomically, old Actions remain historical, and old-cycle completed Actions cannot satisfy or block the new cycle.
- **AC-11:** Given an authenticated Requester, when dashboard data is retrieved, then counts/lists include only owned Tickets and rolling windows use one server-UTC `generatedAt` snapshot with inclusive documented boundaries.
- **AC-12:** Given authenticated IT Staff/Admin, when staff dashboard data is retrieved, then current Action metrics include only current-cycle Actions whose parent Tickets are active; historical/terminal-parent Actions do not pollute current-work metrics.
- **AC-13:** Given an Administrator, when Lab 4 staff behavior is used, then Actions Taken, staff dashboard, and final Ticket transitions are authorized consistently for support/testing while User Management remains available.
- **AC-14:** Given a dashboard actionable card/list item, when activated, then it opens the documented Queue/My Tickets/Ticket Detail drill-down with matching filter intent.
- **AC-15:** Given concurrent parent/child changes, when stale `expectedTicketVersion` or `expectedActionVersion` is submitted, then `409 STALE_UPDATE` is returned and no projection/event partial write occurs.
- **AC-16:** Given the Lab 3 database state, when Lab 4 migration runs, then all existing rows/relationships remain valid, Ticket version/cycle/resolution backfill follows the contract, and legacy no-Action Tickets are preserved.
- **AC-17:** Given the Lab 4 seed runs repeatedly, then cycle-aware Action/Event/dashboard fixtures exist without accumulating duplicates.
- **AC-18:** Given each Action create/edit/reassign/start/complete/cancel mutation, when it succeeds, then exactly one immutable Action event captures authenticated actor and resulting revisions plus relevant status/assignee metadata.
- **AC-19:** Given repeated clicks or recoverable failures, when a Lab 4 form retries, then duplicate Actions are prevented and entered data is preserved where recovery is possible.
- **AC-20:** Given any major Lab 4 screen on desktop/tablet/mobile, when rendered and operated by keyboard, then required controls remain visible/usable with no material clipping, overlap, or page-level horizontal overflow.
- **AC-21:** Given the final Lab 4 integrated state, when representative Labs 1-3 regression tests run, then actual results are recorded without rewriting completed Lab 3 history; any Lab 4-required correction follows the Lab 4 branch/review flow.
- **AC-22:** Given final verification, when required unit/API/integration/UI/style/responsive/authorization/workflow/migration/regression/performance-smoke/E2E suites run, then `tests.md` traceability and final statuses match actual repository evidence.

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

- **AD-01:** The handout explicitly says “Action create date/time” for Ticket Detail. Therefore `actionDateTime=createdAt` is an immutable audit timestamp because the handout says “Action create date/time.” Consequence: Lab 4 does **not** support retrospective work-occurrence timestamps; if work happened earlier and is entered later, Action Date/Time records when the Action record was created, while the narrative fields may describe when work actually occurred. A separate backdated occurrence field would be new scope not required by the handout.
- **AD-02:** The submission evidence requires assign/edit/status transition/complete/cancel, so the minimal four-state Action lifecycle remains `PLANNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`; direct `PLANNED -> COMPLETED` is intentionally allowed for one-step work to avoid unnecessary Start ceremony.
- **AD-03:** Assignee is accountable, not advisory. Only the current assignee may complete; another permitted staff member must reassign first. This makes auto `Performed by` auditable and meaningful.
- **AD-04:** Lab 4 explicitly says Administrator may “Perform IT Staff behavior” for support/testing. Therefore Administrator receives the same Lab 4 Action/status workflow authority on accessible Tickets, even though Lab 3 previously kept normal status transitions IT Staff-only. This is a new Lab 4 rule, not a historical Lab 3 rewrite.
- **AD-05:** Resolution requires positive current-cycle work evidence: at least one completed Action and no active Action. Zero/cancelled-only Actions do not prove completed work.
- **AD-06:** Reopening increments a workflow cycle so historical completed work cannot satisfy a later resolution.
- **AD-07:** Follow-up Required is planning/evidence metadata, not a separate workflow object. It does not independently block resolution after completion because the handout defines the flag/note but no follow-up lifecycle, due date, or closure state. Any outstanding follow-up work that must block resolution must be represented as a new current-cycle Action; that Action is then covered by the active-Action gate. This rule is verified explicitly in planned workflow tests.
- **AD-08:** Seven-day recently-updated window represents one operational week; 30-day recently-resolved window represents a concise one-month reference period. Both use one server UTC snapshot, inclusive lower/upper bounds, and deterministic id tie-breaks.
- **AD-09:** Global create UUID remains a database uniqueness key. Privacy is checked before replay conflict semantics: reuse that points only to an unauthorized/protected resource returns safe `404 NOT_FOUND`; authorized-context mismatch returns `409 ACTION_REPLAY_CONFLICT`. Immutable create fingerprint distinguishes exact original-intent replay after the mutable Action projection changes.
- **AD-10:** Append-only Action events are introduced because mutable Action projection alone cannot prove who reassigned/edited/transitioned work over time. One successful mutation produces exactly one event at the resulting Action version; replay and failed/stale requests produce none. Events are audit evidence, not a second editable workflow.
- **AD-11:** Dashboard route names use `/api/dashboards/*` because they are read-only role-specific summary resources rather than Ticket-operation commands under `/api/staff/*`; no alias routes are added.
- **AD-12:** Existing Project #3 is reused because it already contains the required Kanban statuses and prior individual sprint history; Lab 4 Issues are new items.
- **AD-13:** Purely historical Lab 3 defects are not fixed by modifying old Lab 3 branches. If an explicit Lab 4 requirement needs shared-code change, that change is new Lab 4 work and follows the Lab 4 review flow.
