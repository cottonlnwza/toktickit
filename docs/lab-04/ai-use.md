# Lab 4 AI Use

This document is a running record of actual Sprint 4 AI assistance. Final submission will select 6-10 key prompts from real work and add a brief reflection. Future prompts/results must not be invented in advance.

## Tools / Models Used

- ChatGPT (OpenAI) — specification analysis, workflow planning, repository inspection through the connected local coding bridge, and drafting/review assistance.

Additional tools/models are added only if actually used during Lab 4.

## Verified Prompt / Interaction Log

| # | Stage | Selected Prompt / Instruction | How It Was Used | Verified Outcome |
|---|---|---|---|---|
| 1 | Lab 4 handout review | Asked ChatGPT to read Lab 4 carefully before starting, following the same disciplined process used for earlier labs. | Requirement discovery and scope control before repository changes. | Lab 4 handout was read before Sprint 4 setup. |
| 2 | Sprint setup | Authorized continuing Lab 4 work through Issue 1, with the explicit rule not to go back and repair completed Lab 3 work; stop when Issue 1 PR is waiting for peer review. | Defined workflow boundary and regression-handling rule for this work session. | Final Lab 3 `main` was synchronized, `lab4-staging` was created, Lab 4 Issues were decomposed, and Issue #63 PR #71 was opened for peer review. |
| 3 | Issue #64 implementation | Authorized continuing Issue 2 through implementation and opening the PR for peer review. | Re-read the Lab 4 database/API requirements, introduced tests before implementation, then implemented the Actions Taken data/API/migration/seed foundation and reran regression. | Actions Taken schema/API/audit events, migration/backfill, idempotent seed data, concurrency checks, and server regression evidence were produced on the Lab 4 feature branch. |
| 4 | PR #72 review correction | Asked ChatGPT to finish the requested PR #72 corrections after peer review. | Converted the review blockers into failing regression tests first, then hardened idempotent Action creation and reran the affected and full server suites. | Cross-Ticket UUID disclosure, concurrent exact/conflicting replay, and stale workflow-cycle fingerprint races were covered and corrected before re-review. |
| 5 | Issue #65 Actions Taken UI | Asked ChatGPT to continue to the next Lab 4 Issue after Issue #64 was approved and merged. | Re-read the Lab 4 UI requirements, extended Ticket Detail with Actions Taken for Staff/Admin and read-only Requester use, added UI tests, and reran affected regressions. | Actions list/create/edit/reassign/start/complete/cancel UI, conditional follow-up fields, stale/domain feedback, responsive layout hooks, and Requester read-only behavior were implemented on the Issue #65 branch. |
| 6 | Issue #66 final Ticket workflow | Asked ChatGPT to continue after Issue #65 was peer-approved and merged. | Re-read the Ticket lifecycle/resolution requirements, introduced failing workflow tests first, then implemented final transition authority, current-cycle resolution gating, optimistic concurrency, Administrator parity, and workflow UI feedback. | Focused workflow/API/UI tests, Requester advisory regression, and both production builds passed before the Issue #66 PR was opened. |
| 7 | Issue #67 role dashboards | Asked ChatGPT to continue directly to the next Issue after PR #74 was approved and merged. | Re-read the Lab 4 dashboard contract, introduced failing dashboard API tests first, then implemented authoritative Requester/Staff/Admin metrics, bounded recent lists, drill-down navigation, responsive dashboard UI, and dashboard tests. | Dashboard unit/API/UI tests and both production builds passed; selected Staff counts were cross-checked against direct database queries before opening the Issue #67 PR. |
| 8 | PR #75 review correction | Asked ChatGPT to resume the Lab 4 workflow and follow the strict review guidance shown in the supplied screenshot. | Read the exact PR #75 requested-changes review, treated both drill-down findings as blockers, added Requester `scope=open` support plus a routable/focusable My Open Actions destination, and added direct regressions for both paths. | Dashboard API/UI tests and both builds passed after the correction; the hardening items identified after PR #74 were also recorded as separate Lab 4 follow-up Issues #76 and #77 instead of rewriting merged history. |

Only real later interactions may be appended.

## AI Verification Rules Used in Lab 4

- The Lab 4 handout is the source of truth for Lab 4 scope.
- Before each Issue, re-read the relevant handout requirements instead of implementing from memory.
- AI-generated contract/code is reviewed against explicit requirements and tests rather than accepted because the agent says it is done.
- Test results, screenshots, review events, and approvals are recorded only after they actually occur.
- Historical Lab 3 defects are not repaired by rewriting completed Lab 3 branches; explicit Lab 4 changes use the Lab 4 workflow.

## My Reflection

Pending final Sprint 4 completion. The final reflection will be written from actual specification-agent and coding-agent experience rather than predicted in advance.
