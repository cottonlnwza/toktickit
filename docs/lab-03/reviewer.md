# Lab 3 Peer Review Record

This file records only real Sprint 3 peer-review events. Do not add approvals, comments, responses, PR links, or merge evidence until they have actually occurred.

## Reviewer Identity

- Author: Thanakorn Soison (`@cottonlnwza`)
- Peer reviewer for Issue #33 / PR #43: `@thananun-7203`
- Additional review requests currently visible on PR #43: `@chaproi`, `@Tanaboonnnnn`, `@Chxtamos`

## Review Log

| Issue | Feature branch | PR | Reviewer | Review / comment | Author response / correction | Approval | Merge |
|---|---|---|---|---|---|---|---|
| #33 Engineering Contract | `feature/lab3-1-engineering-contract` | [PR #43](https://github.com/cottonlnwza/toktickit/pull/43) | `@thananun-7203` | First review requested four contract corrections (BR-01..BR-05, deterministic migration/provisioning, Ticket-create idempotency, explicit Test ID -> file paths). Re-review of commit `ad1832b` confirmed those corrections and left one blocker: align the `clientRequestId` migration/data wording with the submitted Lab 2 baseline where `Ticket.clientRequestId` already exists as a unique field. Minor: update the PR summary to 41 Business Rules. | First-round corrections were pushed in `ad1832b`. Current follow-up correction is prepared to preserve the existing globally unique `clientRequestId` field/values instead of introducing nullable requester-scoped composite uniqueness, while retaining the reviewed UUID/replay/conflict behavior. The inaccurate baseline explanation has been removed. Approval and merge remain Pending until this correction is pushed and re-reviewed. | Pending | Pending |
| #34 User Migration and Seed | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| #35 Authentication | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| #36 Authorization and Requester Regression | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| #37 IT Staff Ticket Queue | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| #38 IT Staff Ticket Operations | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| #39 Administrator User Management | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| #40 E2E and Regression | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| #41 Responsive / Accessibility / Visual | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| #42 Release Integration / Evidence | Pending | Pending | Pending | Pending | Pending | Pending | Pending |

## Review Rules

- Feature PRs target `lab3-staging`.
- Peer reviewer performs Review -> Approve -> Merge.
- The author does not self-approve or self-merge feature PRs.
- If review requests changes, the Issue returns to `Fixing`; corrections are pushed to the same feature PR, responses are recorded, and re-review is requested.
- Final entries must link to actual GitHub PR/review/comment evidence.
