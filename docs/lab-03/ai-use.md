# Lab 3 AI Use Record

This file tracks real AI use during Sprint 3. Final submission will select 6-10 representative prompts and include a brief `My Reflection`. Do not invent prompt history.

## LLM / Agent Use

- Specification / planning assistant: ChatGPT (OpenAI)
- Coding / repository assistant: ChatGPT using the approved local repository bridge when authorized by the student

## Candidate Prompt Log

Record or select only prompts that were actually used. Early real Sprint 3 examples include:

1. Read the Lab 3 handout in detail and use it as the source of truth before beginning each Issue; do not invent scope outside the handout.
2. Apply the real PR #43 peer-review feedback to the Engineering Contract: restore the handout's BR-01..BR-05 meanings, make migration/provisioning deterministic, define Ticket-create idempotency, make Test ID-to-file mappings explicit, align the Attachment DTO contract, and keep approval/merge evidence pending until it actually occurs.
3. Apply the real PR #45 Issue 2 review blockers: reconcile the custom data-preserving Lab 3 migration with Prisma migration history and clean deployment, make malformed scrypt hashes fail closed with negative tests, and strengthen migration/seed invariants to match MIG-01/MIG-02 before requesting re-review.
4. Implement Issue #35 Authentication Foundation only after re-reading the Lab 3 contract: write the planned authentication/UI tests first, confirm a legitimate red state, then implement login/current-user/logout/change-password, session/CSRF/throttle behavior, and the authenticated shell without pulling Issue #36 ownership work forward.
5. Apply PR #46 review blockers by enforcing the mandatory password gate on a real production route, making concurrent credential rotation single-winner, preserving the 15-minute failed-attempt window, restoring production Requester continuity, and protecting exported domain routes before re-review.
6. Implement and verify Issue #36 Authorization and Requester Regression from the approved Lab 3 contract using TDD: replace client-supplied Requester identity with the authenticated Requester, add canonical owned Ticket/Attachment APIs with safe cross-owner responses, preserve Lab 2 Requester workflows, add Public Comments/Problem Appears Resolved, and run focused plus full regression/build/database-safety verification.
7. Apply PR #47 reviews `5250377027`, `5250628688`, and `5250893318` by defining `Problem Appears Resolved` lifecycle eligibility from BR-24, closing the validation/write race with one row-locked database transaction, and making the concurrency regression explicitly start the Requester HTTP request before releasing the Staff transaction so the test proves the request actually waits on the row lock and then observes the committed ineligible status.
8. Implement Issue #38 IT Staff Ticket Operations end-to-end after re-reading the Lab 3 contract, apply PR #50 review `5255008801` for domain-specific UI feedback, then apply exact-HEAD review `5255066969` after the merge by reproducing the claimant eligibility race and serializing/re-checking active Staff/Administrator ownership eligibility under row locks so concurrent deactivate/demote cannot persist an invalid owner before starting Issue #39.
9. Implement Issue #39 Administrator User Management with TDD from the approved Lab 3 contract: add the minimalist User list/search/role filter/create/edit/deactivate/new-initial-password workflow, enforce duplicate/role/self-deactivation/last-active-Administrator/no-delete rules, revoke target sessions, preserve BR-18 when owners become ineligible, and keep non-Administrator access safely forbidden.
10. Implement Issue #40 as test/regression work only, then apply PR #53 review `5255861321`: add the required authentication, Staff/Requester, Administrator, REG-01/REG-02 and UNIT-01 coverage; run Playwright against an isolated `_test` database across desktop/tablet/mobile; and harden the destructive reset guard with explicit connection-target parsing plus regression cases for exact development URL, same database under different credentials, invalid non-`_test`, and valid isolated `_test` targets without weakening protection to satisfy the review.

The final file should retain only 6-10 representative prompts that best demonstrate specification-agent and coding-agent use.

## My Reflection

Pending until the Sprint 3 implementation/review cycle provides enough real evidence for a meaningful reflection.
