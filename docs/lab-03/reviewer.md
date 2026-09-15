# Lab 3 Peer Review Record

This file records only real Sprint 3 peer-review events. Do not add approvals, comments, responses, PR links, or merge evidence until they have actually occurred.

## Reviewer Identity

- Author: Thanakorn Soison (`@cottonlnwza`)
- Peer reviewer for Issue #33 / PR #43: `@thananun-7203`
- Additional review requests currently visible on PR #43: `@chaproi`, `@Tanaboonnnnn`, `@Chxtamos`

## Review Log

| Issue | Feature branch | PR | Reviewer | Review / comment | Author response / correction | Approval | Merge |
|---|---|---|---|---|---|---|---|
| #33 Engineering Contract | `feature/lab3-1-engineering-contract` | [PR #43](https://github.com/cottonlnwza/toktickit/pull/43) | `@thananun-7203` | Changes requested: restore mandatory BR-01..BR-05 meanings; make migration/provisioning deterministic; define Ticket-create idempotency; make Test ID -> file mappings explicit. Minor: align Attachment DTO, record review event, consider dedicated migration test. | Correction addresses all four blockers and the minor cleanup: restored BR-01..BR-05; exact legacy-ID migration and rerun-safe credential provisioning; explicit `clientRequestId` create replay/conflict contract; fixed Test ID -> exact file paths including dedicated migration/seed tests; aligned/documented Attachment DTO naming. Current Lab 2 `main` inspection did not contain `clientRequestId`, so the correction documents the retry-safe behavior explicitly as the reviewed Lab 3 contract rather than claiming an unverified baseline field. Approval and merge remain pending until reviewer re-checks the updated PR. | Pending | Pending |
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
