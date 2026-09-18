# Lab 3 Sprint Engineering Specification

Status: Draft engineering contract for Issue #33. This document must be reviewed and approved before Lab 3 implementation begins.

## 1. Sprint Goal

Replace the Lab 2 Development Requester selector with secure authenticated users and role-based authorization while preserving the completed Requester ticket and attachment workflows. Add the first operational IT Staff Ticket Queue/Ticket Detail workflow and a deliberately minimalist Administrator User Management screen, all using the existing Zen Green design language.

## 2. Stakeholder Request

TokTickIT must identify users through email/password authentication instead of a temporary requester selector. Requesters continue to work only with their own Tickets. IT Staff gain a shared operational workflow for locating and progressing Tickets, while Administrators gain only the account-management functions needed to support authentication and roles. Initial-password users must change their password before normal application use, and all protected behavior must be enforced by the backend rather than by hidden frontend controls.

## 3. Scope

### 3.1 Included

- Email/password authentication, current-user retrieval, logout, and mandatory first-login password change.
- Exactly one role per User: Requester, IT Staff, or Administrator.
- Role-specific navigation and backend authorization.
- Migration of Lab 2 `RequesterUser` identities to the authenticated User model while preserving existing Ticket and Attachment data.
- Authenticated continuation of Lab 2 Requester Create Ticket, My Tickets, Ticket Detail, and Attachment functions.
- Requester Public Comments and a non-status-changing `Problem Appears Resolved` indication.
- IT Staff Ticket Queue with search, filters, sorting, pagination, ownership/status visibility, and responsive layouts.
- IT Staff Ticket Detail with claim/assignment/reassignment, IT Priority, permitted status transitions, Public Comments, Internal Notes, and existing Attachments.
- Minimal Administrator User Management: list, name/email search, optional role filter, create, basic edit, one-role assignment, activation/deactivation, and new initial password.
- Required Administrator safety rules, secure error behavior, migration/regression coverage, and final evidence.
- Zen Green UI extensions for Login, Change Password, authenticated shell, Staff Queue, Staff Detail, and User Management.

### 3.2 Explicitly Excluded

- Email invitations or password-reset email.
- MFA, social login, SSO, self-registration, and Requester-created accounts.
- Actions Taken by IT Staff.
- Formal SLA calculation, escalation rules, and notification services.
- KPI dashboards beyond simple queue counts.
- Multi-tenant organizations, departments, customer administration, profile photos, and extended user profiles.
- Production/cloud infrastructure changes.
- Multiple roles per user.
- User deletion, bulk user operations, import/export, role/account-history screens.
- Account unlocking, administrator approval workflows, and advanced identity-management functions.
- Mandatory Administrator-list pagination, multi-column sorting, or multiple simultaneous filters.

## 4. Functional Requirements

### Authentication and application shell

- **FR-01:** The system shall authenticate an active User using email and password.
- **FR-02:** The backend shall expose the current authenticated User using only safe identity fields.
- **FR-03:** Logout shall invalidate the current authenticated session.
- **FR-04:** A User marked `mustChangePassword` shall be restricted to password-change/logout/current-user actions until a valid new password is saved.
- **FR-05:** The authenticated shell shall show the current User name and role and shall expose only navigation permitted for that role.

### Authorization and Requester regression

- **FR-06:** Every protected endpoint shall enforce authentication, role authorization, and ownership on the backend.
- **FR-07:** Requester ownership shall be derived from the authenticated User and never from a client-supplied requester identity.
- **FR-08:** Lab 2 Requester Create Ticket, My Tickets, Ticket Detail, and Attachment functions shall continue under authenticated identity, including deterministic protection against duplicate Ticket creation when the client retries the same create request.
- **FR-09:** The Development Requester selector and Change Requester action shall be removed from the Lab 3 application.
- **FR-10:** A Requester shall be able to create/read Public Comments on an owned Ticket and indicate `Problem Appears Resolved` without formally changing Ticket status to Resolved or Closed.

### IT Staff operations

- **FR-11:** IT Staff shall have a shared Ticket Queue supporting the approved search, filters, sorting, and pagination contract.
- **FR-12:** IT Staff shall be able to open permitted Ticket Detail and see grouped Ticket, Requester, ownership, priority, status, comments, notes, and Attachment information.
- **FR-13:** IT Staff shall be able to claim an unassigned Ticket and assign/reassign/unassign its primary owner according to the ownership rules.
- **FR-14:** IT Staff and Administrator shall be able to update IT Priority; Requesters shall not.
- **FR-15:** IT Staff shall be able to perform only transitions allowed by the approved Ticket status-transition matrix.
- **FR-16:** Public Comments shall be retrievable by Requester, IT Staff, and Administrator according to Ticket access rules; Requester and IT Staff may create them.
- **FR-17:** Internal Notes shall be retrievable only by IT Staff and Administrator; only IT Staff may create Internal Notes in the normal Lab 3 workflow.

### Administrator user management

- **FR-18:** Administrator shall have one User Management screen listing Name, Email, Role, Status, and Edit action.
- **FR-19:** Administrator shall be able to search Users by name/email and optionally filter by role.
- **FR-20:** Administrator shall be able to create a User with name, email, exactly one role, activation state, and an initial password.
- **FR-21:** Administrator shall be able to edit name, email, role, and activation state.
- **FR-22:** Administrator shall be able to set a new initial password that requires change at the User's next login.
- **FR-23:** The backend shall enforce duplicate-email, valid-role, self-deactivation, last-active-Administrator, and no-delete safety rules.

### Data, quality, and evidence

- **FR-24:** Existing Categories, Related Systems, Tickets, and Attachments shall remain valid after migration.
- **FR-25:** Seed behavior shall be idempotent and provide the minimum Lab 3 Requester, IT Staff, Administrator, Ticket, Public Comment, and Internal Note data.
- **FR-26:** All major screens shall provide meaningful processing, validation, success, empty/no-results, forbidden/not-found/conflict, and safe failure feedback where applicable.
- **FR-27:** All major Lab 3 screens shall remain usable at desktop, tablet, and mobile widths and preserve Lab 2 accessibility expectations.

## 5. Business Rules

### 5.1 Authentication and password rules

- **BR-01:** Only an active User with valid credentials may authenticate.
- **BR-02:** A User marked `mustChangePassword` cannot enter normal application screens until a valid new password is saved.
- **BR-03:** The authenticated User identity, not a `requesterId` supplied by the client, determines ownership of Requester operations.
- **BR-04:** Public Comments are visible to the Requester, IT Staff, and Administrator according to Ticket access rules. Internal Notes are visible only to IT Staff and Administrator and are never included in Requester responses.
- **BR-05:** A Requester may indicate that the problem appears resolved, but cannot formally set the Ticket to Resolved or Closed.
- **BR-06:** Email addresses are trimmed and compared case-insensitively by storing a normalized lowercase value; duplicate normalized emails are rejected.
- **BR-07:** Passwords are exact values and are not silently trimmed or case-normalized.
- **BR-08:** A valid new password is 12-128 characters, is not all whitespace, must differ from the current/initial password, and must match the confirmation field. No additional composition rule is imposed because length plus secure hashing is the primary control for this course lab.
- **BR-09:** Passwords are never stored in plaintext. They are stored as versioned `scrypt` hashes with a unique random salt per password.
- **BR-10:** Five failed login attempts for the same normalized email and client address within 15 minutes trigger a temporary 15-minute server-side throttle. A successful login does not erase failed attempts that are still inside that 15-minute counting window. This is not a permanent account lock and needs no Administrator unlock workflow.
- **BR-11:** Invalid credentials return a generic authentication failure. An inactive valid account returns a clear inactive-account response without returning profile or credential details.
- **BR-12:** An authenticated session expires after 8 hours absolute time. Expired/revoked sessions are rejected.
- **BR-13:** Logout revokes the current session. A successful password change revokes other sessions for that User and rotates the current session/CSRF token. Browser authentication uses credentialed requests only from approved frontend origin(s); wildcard credentialed CORS is forbidden.

### 5.2 Identity, roles, and authorization

- **BR-14:** Each User has exactly one role: `REQUESTER`, `IT_STAFF`, or `ADMINISTRATOR`.
- **BR-15:** Hidden or disabled frontend controls are feedback only; authorization is always re-checked by the backend.
- **BR-16:** A Requester attempting another Requester's Ticket/Attachment receives a safe not-found style response so resource existence is not leaked.
- **BR-17:** A role-forbidden endpoint returns a safe forbidden response without protected Ticket, Attachment, Internal Note, or User data.

### 5.3 Ticket ownership, priority, and status

- **BR-18:** A Ticket has zero or one primary owner. The owner, when present, must be an active IT Staff or Administrator User.
- **BR-19:** A newly created or migrated Ticket may be unassigned.
- **BR-20:** Requested Priority remains the Requester-submitted value and is never overwritten by IT Staff operations.
- **BR-21:** On Ticket creation/migration, IT Priority initially equals Requested Priority. Only IT Staff or Administrator may later change IT Priority.
- **BR-22:** Required status values are `New`, `Open`, `In Progress`, `Waiting for Requester`, `Resolved`, `Closed`, `Reopened`, and `Cancelled`.
- **BR-23:** Only IT Staff may perform normal status transitions in Lab 3. Administrator remains conceptually focused on User Management.
- **BR-24:** Allowed IT Staff transitions are:

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

- **BR-25:** Transitions to Resolved, Closed, Cancelled, or Reopened require explicit UI confirmation. The backend independently validates the transition whether or not the client displayed confirmation.
- **BR-26:** Actions Taken are not modeled or validated in Lab 3; any future Actions-Taken resolution rule is deferred to Lab 4.

### 5.4 Public Comments and Internal Notes

- **BR-27:** Public Comments and Internal Notes are append-only in Lab 3; editing and deletion are not exposed.
- **BR-28:** Comment/Note author and creation timestamp are always assigned by the backend from the authenticated User and server clock.
- **BR-29:** Comment/Note content is trimmed for validation, must contain 1-2000 characters after trimming, and is stored/rendered as plain text. User-supplied HTML/Markdown is not interpreted.

### 5.5 Administrator safety rules

- **BR-30:** Administrator may create a User only with one permitted role.
- **BR-31:** Duplicate normalized email addresses and invalid role values are rejected.
- **BR-32:** User accounts are deactivated, not deleted.
- **BR-33:** An Administrator cannot deactivate their own account.
- **BR-34:** An operation that would leave zero active Administrators, including deactivation or changing the last active Administrator to another role, is rejected.
- **BR-35:** Setting a new initial password hashes the password and sets `mustChangePassword=true` for the target User. Deactivation, role change, or new-initial-password actions revoke the target User's active sessions; backend authorization also re-checks the User's current active state and role.

### 5.6 Migration, provisioning, regression, and failure behavior

- **BR-36:** Every legacy `RequesterUser` is migrated deterministically to a `User` with the exact same numeric `id`, name, normalized email, activation state, and timestamps. Existing `Ticket.requesterId` and Attachment removal actor references are repointed to that exact User id inside one migration transaction; if the exact id/email mapping cannot be satisfied, migration fails instead of silently remapping ownership.
- **BR-37:** Legacy Requester credential provisioning is create-only and rerun-safe. A migrated Requester receives the documented local initial password only when its `User` row is first created, stored only as a salted hash with `mustChangePassword=true`. Re-running seed/provisioning logic must not overwrite an existing User's `passwordHash`, `mustChangePassword`, or already-changed credentials.
- **BR-38:** Authenticated Lab 3 Ticket creation requires a client-generated `clientRequestId` UUID with global uniqueness. The verified Lab 2 repository/database baseline does not contain this column, so the Lab 3 migration adds it and deterministically backfills every legacy Ticket before enforcing `NOT NULL` and the global unique constraint. Replaying the same `clientRequestId` by the same authenticated Requester with the same normalized create payload returns the original Ticket without creating another row; reusing that id with a different payload or from a different Requester returns `409 IDEMPOTENCY_CONFLICT` without exposing another Requester's Ticket.
- **BR-39:** Existing Lab 2 Ticket and Attachment data must remain addressable after migration; no migration may silently discard ownership or Attachment metadata.
- **BR-40:** Validation failures do not create partial domain records. Multi-record operations use a database transaction where atomicity is required.
- **BR-41:** Unexpected errors return a safe generic server error and do not expose stack traces, password hashes, session tokens, CSRF tokens, storage paths, or protected-resource existence.
- **BR-42:** `Problem Appears Resolved` is available only while an owned Ticket is in `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, or `REOPENED` — the same lifecycle states from which BR-24 permits IT Staff to transition formally to `RESOLVED`. Ownership, current-status eligibility, and the first indication write are evaluated under one database row lock/transaction so a concurrent status change cannot slip between validation and mutation. `NEW`, `RESOLVED`, `CLOSED`, and `CANCELLED` are ineligible; the backend returns a safe `409 RESOLUTION_INDICATION_NOT_ALLOWED` and does not write or replace the indication. Repeated requests remain idempotent only while the Ticket is still in an eligible state.

### 5.7 Authorization Matrix

`Allow` means the backend may authorize the operation when all ownership/state validation also succeeds. `No` means the backend rejects the operation.

| Operation | Requester | IT Staff | Administrator |
|---|---:|---:|---:|
| Login/logout/current user/change own required password | Allow | Allow | Allow |
| Create Ticket | Allow | No | No |
| View Requester My Tickets | Own only | No | No |
| View Requester Ticket/Attachment | Own only | No through Requester API | No through Requester API |
| Upload/download/soft-remove Requester Attachment | Own only | No through Requester API | No through Requester API |
| Post Public Comment | Own Ticket | Allow | No |
| Read Public Comment | Own Ticket | Allow | Allow |
| Indicate Problem Appears Resolved | Own Ticket | No | No |
| View IT Staff Ticket Queue | No | Allow | No |
| View Staff Ticket Detail | No | Allow | Read for oversight where directly addressed |
| Claim/assign/reassign/unassign Ticket owner | No | Allow | No |
| Be selected as primary Ticket owner | No | Active User only | Active User only |
| Change IT Priority | No | Allow | Allow |
| Change Ticket status | No | Allow per matrix | No |
| Create Internal Note | No | Allow | No |
| Read Internal Note | No | Allow | Allow |
| List/search/create/edit/deactivate Users | No | No | Allow |
| Set another User's initial password | No | No | Allow |

Administrator Ticket permissions above are intentionally limited to the minimum explicitly required by the Lab 3 handout (Internal Note/Public Comment visibility, valid ownership target, and IT Priority authority). The normal Administrator navigation exposes User Management, not the IT Staff Queue.

## 6. UI Specification Summary

- Reuse the Lab 2 Zen Green tokens and Bootstrap foundation; details are in `docs/lab-03/ui-spec.md`.
- Replace the Development Requester identity/Change Requester UI with authenticated name, role, Logout, and permitted password action.
- Login provides email/password validation, busy state, inactive/invalid safe feedback, and no authenticated navigation.
- Change Password blocks the normal shell until completion when `mustChangePassword=true`.
- Requester retains Create Ticket, My Tickets, Ticket Detail, and Attachments; Ticket Detail gains Public Comments and `Problem Appears Resolved`.
- IT Staff Queue uses a readable desktop table and cards/stacked rows at smaller widths. Final list fields are Ticket Number, Summary with Requester secondary text, Requested Priority, IT Priority, Status, Owner, Last Updated, and Open action. Category/Related System remain available as filters/detail fields rather than extra dense columns.
- IT Staff Ticket Detail groups immutable Requester/Ticket information separately from operational ownership, IT Priority, and status controls. Public Comments and Internal Notes use visibly different sections and labels.
- Administrator User Management is one responsive list plus create/edit panel/modal and remains intentionally minimalist.
- All screens provide meaningful loading/saving/success/validation/empty/no-results/forbidden/not-found/conflict/safe-failure feedback where applicable.

## 7. Data Changes

### 7.1 Planned models and fields

The following Prisma-level contract removes migration ambiguity. `Required` means the column is non-null after the migration is complete. `No default` means creation/migration code must supply the value explicitly.

#### User

| Field | Prisma type / constraint | Nullability / default | Relationship / index contract |
|---|---|---|---|
| `id` | `Int @id @default(autoincrement())` | Required | Legacy Requesters keep the exact existing numeric id; reset the sequence above the migrated maximum before inserting new Users. |
| `name` | `String` | Required; no default | Trimmed non-empty application validation. |
| `email` | `String @unique` | Required; no default | Stored normalized lowercase; global unique constraint is the duplicate-email boundary. |
| `role` | `UserRole` | Required; no default | Enum exactly `REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`; no implicit role is assigned. Add `@@index([role, isActive])` for role/activation lookup. |
| `isActive` | `Boolean @default(true)` | Required; default `true` | Migrated Requesters preserve their existing activation value. |
| `passwordHash` | `String` | Required; no default | Stores only the versioned salted `scrypt` hash; plaintext is never persisted. |
| `mustChangePassword` | `Boolean @default(true)` | Required; default `true` | First local credential and Administrator initial-password reset set this to `true`; successful change sets `false`. |
| `createdAt` | `DateTime @default(now())` | Required | Preserve the legacy Requester timestamp during migration. |
| `updatedAt` | `DateTime @updatedAt` | Required | Preserve the legacy Requester value during initial migration, then Prisma maintains it. |

User relation names are fixed for implementation: `requestedTickets` (Ticket requester), `ownedTickets` (Ticket owner), `problemResolutionIndications`, `attachmentRemovals`, `publicComments`, `internalNotes`, and `sessions`. The database stores only the normalized lowercase email in `User.email`; there is no second display-email column. Case-insensitive uniqueness is therefore deterministic: trim + lowercase before insert/update, then enforce `User.email @unique`. Migration must preflight the normalized legacy emails and abort before writes if two legacy rows would normalize to the same value.

#### AuthSession

| Field | Prisma type / constraint | Nullability / default | Relationship / index contract |
|---|---|---|---|
| `id` | `String @id @default(uuid())` | Required | Session record identifier; not used as the browser credential. |
| `userId` | `Int` | Required; no default | FK `User(id)` with `onDelete: Cascade`; add `@@index([userId, revokedAt])`. |
| `tokenHash` | `String @unique` | Required; no default | SHA-256 hash of the opaque session token; raw token exists only in the `HttpOnly` cookie. |
| `csrfTokenHash` | `String` | Required; no default | Hash of the current CSRF token; rotated when the contract requires it. |
| `createdAt` | `DateTime @default(now())` | Required | Server-created timestamp. |
| `expiresAt` | `DateTime` | Required; no default | Absolute eight-hour expiry calculated at session creation; add `@@index([expiresAt])`. |
| `revokedAt` | `DateTime?` | Nullable; default `NULL` | Non-null means the session is invalid even before expiry. |

The Prisma relation is fixed as `user User @relation(fields: [userId], references: [id], onDelete: Cascade)`. Session lookup uses the unique `tokenHash`; cleanup/authorization may use `@@index([userId, revokedAt])` and `@@index([expiresAt])`. No session field is backfilled for migrated Users because sessions are created only after Lab 3 authentication exists.

#### Ticket changes

Existing `Ticket.id`, `ticketNumber`, `categoryId`, `relatedSystemId`, `summary`, `description`, `requestedPriority`, `createdAt`, `updatedAt`, and their existing foreign keys/constraints are preserved unless explicitly changed below.

| Field | Prisma type / constraint | Nullability / default | Relationship / index contract |
|---|---|---|---|
| `requesterId` | `Int` | Required; no default | FK changes from `RequesterUser(id)` to `User(id)` with `onDelete: Restrict`; migrated id value is unchanged. Deactivation does not break ownership. |
| `clientRequestId` | `String @unique` | Required after backfill; no runtime default | New Lab 3 field. Migration first adds it nullable, backfills each legacy Ticket deterministically as `00000000-0000-5000-8000-` plus the zero-padded 12-digit legacy `Ticket.id`, verifies uniqueness/non-null, then makes it required and globally unique. New Lab 3 creates must supply a client-generated UUID; never use requester-scoped composite uniqueness. |
| `ownerId` | `Int?` | Nullable; default `NULL` | FK `User(id)` with `onDelete: SetNull`; application validation permits only active `IT_STAFF`/`ADMINISTRATOR`. Add `@@index([ownerId, updatedAt])`. |
| `requestedPriority` | existing `RequestedPriority` | Required | Preserved requester-submitted value. Add `@@index([requestedPriority, updatedAt])` for Staff Queue filtering/order. |
| `itPriority` | `RequestedPriority` | Required; no static DB default | Migration sets `itPriority=requestedPriority`; create does the same explicitly. Add `@@index([itPriority, updatedAt])`. |
| `currentStatus` | expanded `TicketStatus @default(NEW)` | Required; default `NEW` | Enum exactly `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`; add `@@index([currentStatus, updatedAt])`. |
| `problemAppearsResolvedAt` | `DateTime?` | Nullable; default `NULL` | Requester indication timestamp only; never changes `currentStatus`. |
| `problemAppearsResolvedById` | `Int?` | Nullable; default `NULL` | FK `User(id)` with `onDelete: SetNull`; actor must be the authenticated Requester for that Ticket. |

Ticket relation declarations are fixed as follows: `requester User @relation("RequestedTickets", fields: [requesterId], references: [id], onDelete: Restrict)`, `owner User? @relation("OwnedTickets", fields: [ownerId], references: [id], onDelete: SetNull)`, and `problemAppearsResolvedBy User? @relation("ProblemResolutionIndications", fields: [problemAppearsResolvedById], references: [id], onDelete: SetNull)`. Existing Category/RelatedSystem/Attachment relations remain.

Staff Queue also requires `@@index([updatedAt])`, `@@index([categoryId, updatedAt])`, and `@@index([relatedSystemId, updatedAt])`. Existing Requester-scoped Lab 2 indexes remain unless a migration is explicitly reviewed to replace an equivalent index.

#### Attachment, PublicComment, and InternalNote

| Model / field | Prisma type / constraint | Nullability / default | Relationship / index contract |
|---|---|---|---|
| `Attachment.removedByUserId` | `Int?` | Nullable; default `NULL` | Replaces `removedByRequesterId` without losing values; FK `User(id)` with `onDelete: SetNull`. Existing Attachment metadata and `@@index([ticketId, removedAt])` remain. |
| `PublicComment.id` | `Int @id @default(autoincrement())` | Required | — |
| `PublicComment.ticketId` | `Int` | Required | FK `Ticket(id)` with `onDelete: Restrict`; add `@@index([ticketId, createdAt])`. |
| `PublicComment.authorId` | `Int` | Required | FK `User(id)` with `onDelete: Restrict`; backend supplies authenticated author; add `@@index([authorId])`. |
| `PublicComment.content` | `String` | Required; no default | Application validation enforces trimmed length `1..2000`; stored/rendered as plain text. |
| `PublicComment.createdAt` | `DateTime @default(now())` | Required | Backend/server timestamp. |
| `InternalNote.id` | `Int @id @default(autoincrement())` | Required | — |
| `InternalNote.ticketId` | `Int` | Required | FK `Ticket(id)` with `onDelete: Restrict`; add `@@index([ticketId, createdAt])`. |
| `InternalNote.authorId` | `Int` | Required | FK `User(id)` with `onDelete: Restrict`; backend supplies authenticated author; add `@@index([authorId])`. |
| `InternalNote.content` | `String` | Required; no default | Application validation enforces trimmed length `1..2000`; stored/rendered as plain text. |
| `InternalNote.createdAt` | `DateTime @default(now())` | Required | Backend/server timestamp. |

`Attachment.removedByUser` uses `@relation("AttachmentRemovedBy", fields: [removedByUserId], references: [id], onDelete: SetNull)`. `PublicComment.ticket` / `InternalNote.ticket` use `onDelete: Restrict`; their `author` relations to `User` also use `onDelete: Restrict` so authorship cannot be silently erased. User deletion is not a Lab 3 product operation; deactivation is the supported lifecycle. `Category` and `RelatedSystem` remain structurally unchanged.

### 7.2 Migration decisions

The migration order is frozen so implementation does not choose a different backfill/FK sequence:

1. **Preflight only, no writes:** record row counts for `RequesterUser`, `Ticket`, and `Attachment`; verify the actual Lab 2 baseline has no `Ticket.clientRequestId` column; compute trimmed lowercase legacy emails and abort if normalization would create a duplicate. Capture the legacy Ticket ids/ticket numbers/requester ids and Attachment linkage needed for post-migration preservation checks.
2. **Create types/tables:** create `UserRole`; create `User` with all required columns/constraints except application relations that still depend on legacy FKs. Do not drop or rename `RequesterUser` yet.
3. **Copy legacy Requesters deterministically:** insert one `User` per `RequesterUser` using the exact same numeric `id`, trimmed name, normalized lowercase email, preserved `isActive`, `createdAt`, and `updatedAt`, role `REQUESTER`, a newly generated salted hash of local initial password `Lab3-ChangeMe-2026`, and `mustChangePassword=true`. Any id/email collision aborts the migration; no alternate id is generated.
4. **Reset identity sequence:** set the `User.id` sequence above `MAX(User.id)` before any new IT Staff/Administrator seed rows are inserted.
5. **Prepare Ticket columns:** add nullable `clientRequestId`, `ownerId Int? DEFAULT NULL`, `itPriority RequestedPriority?`, `problemAppearsResolvedAt DateTime? DEFAULT NULL`, and `problemAppearsResolvedById Int? DEFAULT NULL`; expand `TicketStatus` to the eight approved values while preserving existing `NEW`. Do not alter `ticketNumber`, requester/category/system IDs, or existing Ticket timestamps/content.
6. **Backfill before NOT NULL:** for each legacy Ticket, set `clientRequestId` to the deterministic migration UUID `00000000-0000-5000-8000-` + the Ticket id left-padded to 12 decimal digits (for example Ticket id `60` -> `00000000-0000-5000-8000-000000000060`). Set `itPriority = requestedPriority`. Verify zero null/duplicate `clientRequestId` values and zero null `itPriority` values; then alter both fields to required/non-null and add the global unique constraint on `clientRequestId`. `ownerId` and both problem-resolution fields remain null for all legacy Tickets.
7. **Repoint ownership FKs:** replace `Ticket.requesterId -> RequesterUser(id)` with `Ticket.requesterId -> User(id) ON DELETE RESTRICT` without changing any requester id values. Rename `Attachment.removedByRequesterId` to `removedByUserId`, preserve every existing value/null, and replace its FK with `User(id) ON DELETE SET NULL`.
8. **Create new relations/tables:** create `AuthSession`, `PublicComment`, and `InternalNote` with the exact fields/FKs/delete behaviors in Section 7.1. Add Ticket owner/problem-resolution FKs and all indexes listed in Section 7.1. No legacy comments/notes/sessions are invented during migration.
9. **Constraint/index verification:** verify `User.email @unique`, the new global `Ticket.clientRequestId @unique`, all new required/non-null constraints, and all named index groups from Section 7.1 exist. Verify every non-null owner/problem actor/removal actor resolves to `User`.
10. **Data-preservation verification:** assert Ticket and Attachment row counts equal the preflight counts; every original Ticket keeps the same `id`, `ticketNumber`, `requesterId`, requested priority, Category/RelatedSystem FK, timestamps, and Attachment linkage/metadata. Additionally verify each legacy Ticket received exactly the deterministic `clientRequestId` derived from its unchanged id and that no two Tickets share a value.
11. **Remove legacy identity table only after verification:** drop `RequesterUser` only after Steps 1-10 succeed. A failure rolls back/aborts rather than leaving partially migrated ownership.
12. **Provision/seed rerun rule:** seed new IT Staff/Administrator/sample data with create-if-missing/update-safe logic. If a User already exists, seed/provisioning must not overwrite `passwordHash`, `mustChangePassword`, or post-migration activation/role changes unless that exact mutation is the explicit subject of the seed fixture.
13. **Client cutover:** retire the Development Requester selector endpoint/client state only after authenticated Requester regression tests exist and the migrated ownership checks pass.

Migration/provisioning is deterministic and rerun-safe. A development/test rerun must validate existing id/email mappings and constraints, make no duplicate Users/Tickets/reference rows, and never reset already-changed credentials.

No migration step may recreate Ticket or Attachment data from scratch.

### 7.3 Required seed decisions

- Seed is idempotent using stable unique emails/ticket numbers and create-if-missing/update-safe logic. Seed reruns may repair non-credential fixture fields intentionally owned by seed data, but they must never reset an existing User's password hash or `mustChangePassword` state.
- Minimum accounts: 4 active + 1 inactive Requester; 3 active + 1 inactive IT Staff; at least 1 active Administrator.
- All seeded accounts use clearly labeled local-lab credentials only. Default development initial password: `Lab3-ChangeMe-2026`; seeded Users start with `mustChangePassword=true` unless a specific test fixture requires an already-changed password.
- Seed realistic Tickets across Requesters, all relevant status/priority combinations, and assigned/unassigned ownership.
- Seed example Public Comments/Internal Notes containing no sensitive information.

## 8. API Contract

Exact shapes and query parameters are defined in `docs/lab-03/api-spec.md`.

- Auth: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password`.
- Requester: authenticated `POST /api/tickets`, `GET /api/tickets/mine`, owned `GET /api/tickets/:ticketId`, Attachment endpoints under `/api/tickets/:ticketId/attachments`, shared Public Comments, and Requester resolution indication.
- Staff: `GET /api/staff/tickets`, `GET /api/staff/tickets/:ticketId`, claim/owner/IT-Priority/status operations.
- Comments/Notes: Public Comments under `/api/tickets/:ticketId/comments`; Internal Notes under `/api/staff/tickets/:ticketId/internal-notes`.
- Administrator: `GET/POST /api/admin/users`, `PATCH /api/admin/users/:userId`, and `POST /api/admin/users/:userId/initial-password`.
- Reference data: Lab 2 Category and Related System endpoints remain available to authenticated roles that need them.
- Lab 2 `/api/requesters` and requesterId-in-path ownership APIs are retired from normal Lab 3 client use.

### 8.1 Authentication decision

- Use an opaque random server-side session token in an `HttpOnly` cookie named `tt_session`; store only a SHA-256 hash of the token in PostgreSQL.
- Cookie: `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` outside local HTTP development.
- Session absolute lifetime: 8 hours.
- State-changing authenticated requests require an `X-CSRF-Token` value associated with the server session plus same-origin/allowed-origin validation. The CSRF token is returned only after successful same-origin login/current-user retrieval and is not stored in localStorage.
- Credentialed CORS uses an explicit configured frontend origin with credentials enabled; wildcard-origin credentialed CORS is not allowed.
- Password hashing uses Node.js `crypto.scrypt` with a unique random 16-byte salt and a versioned stored format. Contract parameters: `N=16384`, `r=8`, `p=1`, 64-byte derived key. Verification uses `timingSafeEqual`.
- Authentication secrets/tokens/password hashes are never returned to client code or committed to source control.

### 8.2 Queue query decision

- Search fields: Ticket Number, Summary, Requester Name, Requester Email.
- Filters: `status`, `requestedPriority`, `itPriority`, `owner` (`unassigned` or User id), `categoryId`, `relatedSystemId`.
- Sortable fields: `updatedAt`, `createdAt`, `ticketNumber`, `requestedPriority`, `itPriority`, `status`.
- Default sort: `updatedAt desc`, tie-break `id desc`.
- Pagination: `page` default 1; `pageSize` default 10; allowed page sizes 10, 25, 50; maximum 50.
- Search is trimmed, case-insensitive, and limited to 100 characters.
- Unknown/invalid query values return HTTP 400 with a safe validation error; they are not silently ignored.
- Queue response returns `items` plus `{page, pageSize, totalItems, totalPages}` metadata.

## 9. Acceptance Criteria

- **AC-01:** Given an active User with valid credentials, when login succeeds, then authenticated access is established and safe User identity/role data is returned.
- **AC-02:** Given invalid credentials or an inactive account, when login is attempted, then access is denied with the approved safe feedback and no credential/profile secrets are exposed.
- **AC-03:** Given a User requiring an initial password change, when login succeeds, then normal application endpoints/screens remain blocked until a valid new password is saved.
- **AC-04:** Given an authenticated User, when Logout succeeds or the session expires, then subsequent protected access is rejected.
- **AC-05:** Given an authenticated User, when the shell renders, then it shows the User name/role and only permitted navigation destinations.
- **AC-06:** Given an authenticated Requester, when another requesterId is supplied or another Requester's resource is addressed, then the backend still applies authenticated ownership and does not disclose the other Requester's protected data.
- **AC-07:** Given migrated Lab 2 data, when the Lab 3 schema/migration is applied, then each legacy Requester keeps its exact numeric identity mapping, existing Ticket ownership and Attachment metadata remain valid, each legacy Ticket receives the specified deterministic unique `clientRequestId` backfill before that new field becomes required, local initial credentials are hashed only on first provisioning, and rerun-safe provisioning does not reset already-changed credentials.
- **AC-08:** Given authenticated Requesters, when they use Create Ticket, My Tickets, Ticket Detail, and Attachments, then the Lab 2 workflows continue without the Development Requester selector; retrying the same Ticket create `clientRequestId` does not create a duplicate Ticket and conflicting reuse is rejected safely.
- **AC-09:** Given an owned Ticket, when a Requester posts a Public Comment, then it is stored with backend author/time and visible to permitted roles.
- **AC-10:** Given an owned Ticket in `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, or `REOPENED`, when a Requester selects Problem Appears Resolved, then the indication is recorded without changing the Ticket to Resolved or Closed; `NEW`, `RESOLVED`, `CLOSED`, and `CANCELLED` reject the action without mutation.
- **AC-11:** Given IT Staff, when Queue queries use valid search/filter/sort/page parameters, then the correct permitted page and pagination metadata are returned; invalid parameters receive HTTP 400.
- **AC-12:** Given the Ticket Queue UI, when loading/empty/no-results/failure or desktop/tablet/mobile states occur, then the approved meaningful responsive presentation is shown.
- **AC-13:** Given an unassigned/assigned Ticket and IT Staff, when claim/assign/reassign/unassign is requested, then only a valid active IT Staff/Administrator owner is persisted.
- **AC-14:** Given a Ticket, when IT Staff or Administrator changes IT Priority, then the new valid value is saved while Requested Priority remains unchanged; Requester attempts are forbidden.
- **AC-15:** Given IT Staff, when a status transition is requested, then only an allowed transition is accepted and invalid/role-forbidden transitions are rejected safely.
- **AC-16:** Given a Public Comment or Internal Note create request, when content is blank/over-limit or contains markup-like text, then validation/plain-text rendering rules are enforced without executable markup.
- **AC-17:** Given a Requester, when an Internal Note endpoint is requested, then access is rejected and no Internal Note content/existence is disclosed.
- **AC-18:** Given permitted IT Staff/Administrator, when Internal Notes are retrieved, then authorized note data includes backend author/time; normal Requester responses never include notes.
- **AC-19:** Given existing Lab 2 Attachments, when Staff Ticket Detail or authenticated Requester Ticket Detail is used, then Attachment continuity and ownership protections remain functional.
- **AC-20:** Given an Administrator, when the user list is opened/searched/role-filtered, then Name, Email, Role, Status, and Edit action are available with documented filtering behavior.
- **AC-21:** Given valid input, when Administrator creates a User, then exactly one role, activation state, hashed initial password, and `mustChangePassword=true` are persisted.
- **AC-22:** Given duplicate email, invalid role, invalid fields, self-deactivation, or an operation removing the last active Administrator, when submitted, then the operation is rejected safely without an invalid partial update.
- **AC-23:** Given an existing User, when Administrator edits allowed fields or sets a new initial password, then only permitted fields change and the new initial password requires change at next login.
- **AC-24:** Given a non-Administrator, when a User Management endpoint/screen is requested, then access is forbidden without exposing protected user-management data.
- **AC-25:** Given the Lab 3 seed command runs repeatedly, then required active/inactive role accounts and realistic Ticket/Comment/Note fixtures exist without duplicate reference data.
- **AC-26:** Given any major Lab 3 screen, when meaningful processing/validation/success/empty/no-results/forbidden/not-found/conflict/failure conditions occur, then safe user feedback is shown where applicable.
- **AC-27:** Given desktop, tablet, and mobile viewports, when major Lab 3 screens render, then there is no material clipping, overlap, hidden required action, unreadable text, or horizontal page overflow and keyboard focus remains visible.
- **AC-28:** Given the final integrated Lab 3 state, when required unit/API/integration/UI/style/responsive/security/migration/regression/E2E suites run, then results and AC traceability in `tests.md` match the actual repository state.

Every AC is mapped to one or more planned tests in `docs/lab-03/tests.md`.

## 10. Definition of Done

Lab 3 is product-complete only when all of the following are true:

- [ ] Approved `specification.md`, `tests.md`, `ui-spec.md`, and `api-spec.md` existed before the main feature implementation was completed.
- [ ] Migration preserves existing Lab 2 Ticket/Attachment data and passes migration/regression checks.
- [ ] Authentication, first-password change, logout, current-user behavior, session expiration, CSRF handling, and safe errors satisfy the contract.
- [ ] Backend authorization enforces the approved role/ownership matrix.
- [ ] Lab 2 Requester features work under authenticated identity with the temporary selector removed.
- [ ] IT Staff Queue and Ticket Detail satisfy approved search/filter/sort/page, ownership, priority, status, Public Comment, Internal Note, and Attachment behavior.
- [ ] Administrator User Management remains within the minimalist Lab 3 scope and enforces all safety rules.
- [ ] Required unit, API/integration, UI component, UI style, responsive, security/authorization, migration/regression, and E2E tests pass from the final integrated state.
- [ ] Major screens pass desktop/tablet/mobile visual and accessibility checks using the Zen Green language.
- [ ] Feature work followed `feature/* -> lab3-staging -> main`, with real peer review/approval/merge evidence.
- [ ] `reviewer.md` and `ai-use.md` contain only real events; no review/test/AI evidence is fabricated.
- [ ] Required Lab 3 screenshots/evidence and Answer Part 1-9 material are readable and traceable to final `main`.

## 11. Assumptions and Decisions

- **AD-01:** Opaque server-side cookie sessions are chosen over browser-stored bearer tokens to keep authentication credentials out of `localStorage` and allow backend revocation.
- **AD-02:** Built-in Node `crypto.scrypt` is chosen for password hashing so the approved baseline does not require an authentication/password dependency solely for hashing. Any later dependency change requires separate approval.
- **AD-03:** The 12-128 character password rule intentionally favors length over arbitrary symbol/uppercase composition rules. Password confirmation and difference-from-current are still required.
- **AD-04:** Login throttling is temporary and server-side; permanent account lock/unlock is excluded from Lab 3.
- **AD-05:** Administrator keeps User Management as its primary responsibility. Limited Ticket read/IT-Priority/note visibility exists only where the handout explicitly requires Administrator visibility/authority; Administrator does not receive the normal IT Staff Queue or status workflow.
- **AD-06:** Public Comments/Internal Notes use a 2000-character limit and plain-text rendering to minimize accidental script/markup execution and public/private confusion.
- **AD-07:** Queue page sizes are 10/25/50 and the default order is latest-updated first; these values are intentionally fixed for deterministic API/UI tests.
- **AD-08:** The optional Administrator role filter is included because it is small, useful, and explicitly allowed; advanced filtering/pagination/sorting remain excluded.
- **AD-09:** `Problem Appears Resolved` is modeled as an indication, not a Ticket status transition, to preserve the handout rule that Requesters cannot formally resolve/close.
- **AD-10:** The existing Lab 2 responsive breakpoints remain authoritative: desktop `>=992px`, tablet `768-991px`, mobile `<768px`.
- **AD-11:** A pre-Issue-#34 audit of the merged Lab 2 schema, migration SQL, Create Ticket implementation/tests, and local baseline database confirmed that `Ticket.clientRequestId` is not present in the actual Lab 2 baseline. Lab 3 therefore introduces the field as a globally unique required replay key. Legacy Tickets receive a deterministic migration-only UUID derived injectively from their existing numeric id; new Lab 3 creates require a client-generated UUID. First submission returns `201`; an identical replay by the owning Requester returns `200` with the original Ticket and `replayed=true`; conflicting or cross-Requester reuse returns `409 IDEMPOTENCY_CONFLICT`.
- **AD-12:** Exact legacy Requester id preservation is chosen instead of a translation table because current Lab 2 Ticket and Attachment foreign keys already use those numeric ids. A collision is a migration error, not a reason to silently remap ownership.
- **AD-13:** Local development keeps the existing Vite client on `http://localhost:5173` and API on `http://localhost:3000`; the API therefore uses an explicit allowed-origin CORS configuration with `credentials: true`, and authenticated client fetches use `credentials: "include"`. Production/cloud deployment design remains out of scope.
- **AD-14:** Login throttling is process-local for this course lab and may reset when the development server restarts. It limits repeated attempts without introducing the excluded account-lock/unlock workflow.
- **AD-15:** Repeating `Problem Appears Resolved` is idempotent: it returns the existing indication instead of creating duplicate status-like events.
- **AD-16:** `GET /api/auth/me` may rotate the CSRF token for the current session so the server can store only a hash while still giving a reloaded client a fresh token. Session authorization always reads the User's current role/active state rather than trusting stale role data stored in the browser.
- **AD-17:** The Requester resolution-indication eligibility set is aligned with BR-24's states that can formally transition to `RESOLVED`: `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, and `REOPENED`. This keeps the indication inside the active service lifecycle instead of allowing it on a brand-new, already-resolved, closed, or cancelled Ticket.
