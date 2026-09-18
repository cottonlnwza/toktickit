# Lab 3 Peer Review Record

This file records only real Sprint 3 peer-review events. Do not add approvals, comments, responses, PR links, or merge evidence until they have actually occurred.

## Reviewer Identity

- Author: Thanakorn Soison (`@cottonlnwza`)
- Peer reviewer, first two review rounds: ธนนันท์ ครังตุ้ย — Student ID `67070507203` — `@thananun-7203`.
- Peer reviewer, third review round: Chartanat Upthaipiboon — Student ID `67070507210` — `@Chxtamos`.
- Peer reviewer: Tanboon Teawsawat — Student ID `67070507211` — `@Tanaboonnnnn`.
- Only submitted reviews are recorded as review evidence below; review requests alone are not treated as approval evidence.

## Review Log

| Issue | Feature branch | PR | Reviewer | Review / comment | Author response / correction | Approval | Merge |
|---|---|---|---|---|---|---|---|
| #33 Engineering Contract | `feature/lab3-1-engineering-contract` | [PR #43](https://github.com/cottonlnwza/toktickit/pull/43) | ธนนันท์ ครังตุ้ย (`@thananun-7203`, `67070507203`); Chartanat Upthaipiboon (`@Chxtamos`, `67070507210`); Tanboon Teawsawat (`@Tanaboonnnnn`, `67070507211`) | Reviews [`5208048077`](https://github.com/cottonlnwza/toktickit/pull/43#pullrequestreview-5208048077), [`5209147892`](https://github.com/cottonlnwza/toktickit/pull/43#pullrequestreview-5209147892), [`5232289027`](https://github.com/cottonlnwza/toktickit/pull/43#pullrequestreview-5232289027), and [`5232925532`](https://github.com/cottonlnwza/toktickit/pull/43#pullrequestreview-5232925532) requested the contract corrections recorded during Issue #33. | Corrections restored BR-01..BR-05, froze deterministic migration/provisioning and replay semantics, made test mappings exact, and completed the migration/evidence invariants. Final exact commit `46632bc` was re-reviewed. | Approved by `@Chxtamos` in review [`5236086832`](https://github.com/cottonlnwza/toktickit/pull/43#pullrequestreview-5236086832) on `46632bc`. | Merged by `@Chxtamos` on 2026-09-17; merge commit `9f89afd`. |
| #34 User Migration and Seed | `feature/lab3-2-user-migration-seed` | [PR #45](https://github.com/cottonlnwza/toktickit/pull/45) | Chartanat Upthaipiboon (`@Chxtamos`, `67070507210`); Tanboon Teawsawat (`@Tanaboonnnnn`, `67070507211`) | `@Chxtamos` review [`5238936733`](https://github.com/cottonlnwza/toktickit/pull/45#pullrequestreview-5238936733) on exact HEAD `85939e5` requested three blockers: deployable/reconciled Prisma migration, fail-closed malformed scrypt verification, and complete MIG-01/MIG-02 invariants. | Commit `fe22519` added the committed/reconciled Lab 3 deployment path, strict malformed-hash validation/tests, normalized-email abort-before-mutation coverage, preservation/FK/index assertions, and seed rerun count/credential invariants. | Approved by `@Tanaboonnnnn` in review [`5245857424`](https://github.com/cottonlnwza/toktickit/pull/45#pullrequestreview-5245857424) on exact HEAD `fe22519`. | Merged by `@Tanaboonnnnn` on 2026-09-18; merge commit `e6fcd37`. |
| #35 Authentication | `feature/lab3-3-authentication` | Pending | Pending | TDD red state was recorded before implementation. Local auth/session/CSRF/throttle/Login/Change Password/shell implementation and regression verification are complete; Issue #36 ownership/domain authorization was intentionally not pulled forward. No PR/review has occurred yet. | Pending | Pending | Pending |
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
