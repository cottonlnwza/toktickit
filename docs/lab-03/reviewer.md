# Lab 3 Peer Review Record

This file records only real Sprint 3 peer-review events. Do not add approvals, comments, responses, PR links, or merge evidence until they have actually occurred.

## Reviewer Identity

- Author: Thanakorn Soison (`@cottonlnwza`)
- Peer reviewer, first two review rounds: ธนนันท์ ครังตุ้ย — Student ID `67070507203` — `@thananun-7203`.
- Peer reviewer, third review round: Chartanat Upthaipiboon — Student ID `67070507210` — `@Chxtamos`.
- Peer reviewer, latest review round on `b8dffd2`: Tanboon Teawsawat — Student ID `67070507211` — `@Tanaboonnnnn`.
- Additional review requests may appear on PR #43; only submitted reviews are recorded as review evidence below.

## Review Log

| Issue | Feature branch | PR | Reviewer | Review / comment | Author response / correction | Approval | Merge |
|---|---|---|---|---|---|---|---|
| #33 Engineering Contract | `feature/lab3-1-engineering-contract` | [PR #43](https://github.com/cottonlnwza/toktickit/pull/43) | ธนนันท์ ครังตุ้ย (`@thananun-7203`, `67070507203`); Chartanat Upthaipiboon (`@Chxtamos`, `67070507210`); Tanboon Teawsawat (`@Tanaboonnnnn`, `67070507211`) | Review [`pullrequestreview-5208048077`](https://github.com/cottonlnwza/toktickit/pull/43#pullrequestreview-5208048077) requested four contract corrections; review [`pullrequestreview-5209147892`](https://github.com/cottonlnwza/toktickit/pull/43#pullrequestreview-5209147892) on `ad1832b` left the Lab 2 `clientRequestId` baseline blocker; review [`pullrequestreview-5232289027`](https://github.com/cottonlnwza/toktickit/pull/43#pullrequestreview-5232289027) on `e72edde` requested deterministic field/null/default/index/FK details plus explicit Requester breakpoint evidence; review [`pullrequestreview-5232925532`](https://github.com/cottonlnwza/toktickit/pull/43#pullrequestreview-5232925532) on exact commit `b8dffd2` requested the remaining migration invariants/backfill/order to be frozen and the Requester evidence mapping to be made unambiguous. | `ad1832b` fixed the first review set; `e72edde` aligned `clientRequestId`; `b8dffd2` added Prisma-level field/FK/index tables and Requester breakpoint coverage. Current correction further freezes normalized-email collision handling, exact relation/delete behavior, Ticket backfill + constraint order, row/value preservation checks, rerun invariants, and exact `desktop.png`/`tablet.png`/`mobile.png` Requester evidence filenames/content. Approval and merge remain Pending until peer re-review of the newly pushed HEAD. | Pending | Pending |
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
