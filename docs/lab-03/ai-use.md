# Lab 3 AI Use Record

This file tracks real AI use during Sprint 3. Final submission will select 6-10 representative prompts and include a brief `My Reflection`. Do not invent prompt history.

## LLM / Agent Use

- Specification / planning assistant: ChatGPT (OpenAI)
- Coding / repository assistant: ChatGPT using the approved local repository bridge when authorized by the student

## Candidate Prompt Log

Record or select only prompts that were actually used. Early real Sprint 3 examples include:

1. Read the Lab 3 handout in detail and use it as the source of truth before beginning each Issue; do not invent scope outside the handout.
2. Decompose Sprint 3 into GitHub Issues/Kanban work covering specification, migration, authentication, authorization, Requester regression, IT Staff interfaces, Administrator User Management, E2E, visual inspection, and release integration.
3. Before every repository/GitHub state change, explain the step and wait for student approval; commit/push/PR/merge require explicit approval.
4. Apply the real PR #43 peer-review feedback to the Engineering Contract: restore the handout's BR-01..BR-05 meanings, make migration/provisioning deterministic, define Ticket-create idempotency, make Test ID-to-file mappings explicit, align the Attachment DTO contract, and keep approval/merge evidence pending until it actually occurs.
5. Apply the real PR #45 Issue 2 review blockers: reconcile the custom data-preserving Lab 3 migration with Prisma migration history and clean deployment, make malformed scrypt hashes fail closed with negative tests, and strengthen migration/seed invariants to match MIG-01/MIG-02 before requesting re-review.
6. Implement Issue #35 Authentication Foundation only after re-reading the Lab 3 contract: write the planned authentication/UI tests first, confirm a legitimate red state, then implement login/current-user/logout/change-password, session/CSRF/throttle behavior, and the authenticated shell without pulling Issue #36 ownership work forward.
7. Apply PR #46 review blockers by enforcing the mandatory password gate on a real production route, making concurrent credential rotation single-winner, preserving the 15-minute failed-attempt window, restoring production Requester continuity, and protecting exported domain routes before re-review.
8. Implement and verify Issue #36 Authorization and Requester Regression from the approved Lab 3 contract using TDD: replace client-supplied Requester identity with the authenticated Requester, add canonical owned Ticket/Attachment APIs with safe cross-owner responses, preserve Lab 2 Requester workflows, add Public Comments/Problem Appears Resolved, and run focused plus full regression/build/database-safety verification.
9. Apply PR #47 reviews `5250377027`, `5250628688`, and `5250893318` by defining `Problem Appears Resolved` lifecycle eligibility from BR-24, closing the validation/write race with one row-locked database transaction, and making the concurrency regression explicitly start the Requester HTTP request before releasing the Staff transaction so the test proves the request actually waits on the row lock and then observes the committed ineligible status.
10. Implement Issue #38 IT Staff Ticket Operations end-to-end after re-reading the Lab 3 contract, then apply PR #50 review `5255008801`: preserve the completed Staff operations/authorization scope, reproduce the reviewer-reported `400 INVALID_TRANSITION` feedback gap with a client regression, distinguish expected validation/domain errors (`INVALID_OWNER`, `INVALID_TRANSITION`, `VALIDATION_ERROR`) from forbidden/not-found/conflict/unexpected failures, and re-run focused/full verification before requesting re-review.

The final file should retain only 6-10 representative prompts that best demonstrate specification-agent and coding-agent use.

## My Reflection

Pending until the Sprint 3 implementation/review cycle provides enough real evidence for a meaningful reflection.
