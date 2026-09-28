# Lab 3 AI Use Record

This file records selected real AI-assisted work from Sprint 3. The handout, approved engineering contract, repository state, and peer review remained the sources of truth; AI output was checked against them before changes were accepted.

## LLM / Agent Use

- Specification / planning assistant: ChatGPT (OpenAI)
- Coding / repository assistant: ChatGPT using the approved local repository bridge when authorized by the student

## Selected Key Prompts

| # | Selected key prompt |
|---:|---|
| 1 | Read the Lab 3 handout in detail and use it as the source of truth before beginning each Issue; do not invent scope outside the handout. |
| 2 | Apply the real PR #43 peer-review feedback to the Engineering Contract: restore the handout's BR-01..BR-05 meanings, make migration/provisioning deterministic, define Ticket-create idempotency, make Test ID-to-file mappings explicit, align the Attachment DTO contract, and keep approval/merge evidence pending until it actually occurs. |
| 3 | Apply the real PR #45 Issue 2 review blockers: reconcile the custom data-preserving Lab 3 migration with Prisma migration history and clean deployment, make malformed scrypt hashes fail closed with negative tests, and strengthen migration/seed invariants to match MIG-01/MIG-02 before requesting re-review. |
| 4 | Implement Issue #35 Authentication Foundation only after re-reading the Lab 3 contract: write the planned authentication/UI tests first, confirm a legitimate red state, then implement login/current-user/logout/change-password, session/CSRF/throttle behavior, and the authenticated shell without pulling Issue #36 ownership work forward. |
| 5 | Implement and verify Issue #36 Authorization and Requester Regression from the approved Lab 3 contract using TDD: replace client-supplied Requester identity with the authenticated Requester, add canonical owned Ticket/Attachment APIs with safe cross-owner responses, preserve Lab 2 Requester workflows, add Public Comments/Problem Appears Resolved, and run focused plus full regression/build/database-safety verification. |
| 6 | Implement Issue #38 IT Staff Ticket Operations end-to-end after re-reading the Lab 3 contract, apply PR #50 review `5255008801` for domain-specific UI feedback, then apply exact-HEAD review `5255066969` after the merge by reproducing the claimant eligibility race and serializing/re-checking active Staff/Administrator ownership eligibility under row locks so concurrent deactivate/demote cannot persist an invalid owner. |
| 7 | Implement Issue #39 Administrator User Management with TDD from the approved Lab 3 contract: add the minimalist User list/search/role filter/create/edit/deactivate/new-initial-password workflow, enforce duplicate/role/self-deactivation/last-active-Administrator/no-delete rules, revoke target sessions, preserve BR-18 when owners become ineligible, and keep non-Administrator access safely forbidden. |
| 8 | Implement Issue #40 as test/regression work only and then carry Issue #41 through the responsive/accessibility/visual audit: keep Playwright on the guarded isolated `_test` database, verify all major role workflows at desktop/tablet/mobile, add the missing STYLE-01 coverage, correct only Zen Green/read-only/focus visual-contract defects, and capture the exact 21-file screenshot evidence matrix without introducing new product features. |
| 9 | Review PR #54 on its exact approved/merged HEAD; if it is valid, close Issue #41, re-read the full Lab 3 handout before Issue #42, audit real review/test/Kanban/screenshot evidence, finalize release documentation, run the complete pre-release verification, and push only verified release-integration changes without self-merging the final release. |

## My Reflection

I used ChatGPT mainly as a specification and coding assistant, while the Lab 3 handout, approved contract, repository state, and peer reviews remained authoritative. The most useful part was repeatedly comparing implementation against explicit rules and tests; this exposed real gaps such as migration assumptions, direct API authentication, lifecycle races, owner-eligibility races, and destructive E2E database safety before final integration. I also learned to keep evidence precise: local test results were recorded as local results, review/merge events were not claimed before they happened, and corrections were re-checked on exact commits. Peer reviewers still made the approval and merge decisions, so the AI assisted the work but did not replace the required engineering review process.
