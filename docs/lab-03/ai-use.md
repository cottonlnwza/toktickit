# Lab 3 AI Use Record

This file tracks real AI use during Sprint 3. Final submission will select 6-10 representative prompts and include a brief `My Reflection`. Do not invent prompt history.

## LLM / Agent Use

- Specification / planning assistant: ChatGPT (OpenAI)
- Coding / repository assistant: ChatGPT using the approved local repository bridge when authorized by the student

## Candidate Prompt Log

Record or select only prompts that were actually used. Early real Sprint 3 examples include:

1. Read the Lab 3 handout in detail and use it as the source of truth before beginning each Issue; do not invent scope outside the handout.
2. Verify the final Lab 2 `main` baseline before starting Lab 3 and do not modify code until the baseline is confirmed.
3. Decompose Sprint 3 into GitHub Issues/Kanban work covering specification, migration, authentication, authorization, Requester regression, IT Staff interfaces, Administrator User Management, E2E, visual inspection, and release integration.
4. Before every repository/GitHub state change, explain the step and wait for student approval; commit/push/PR/merge require explicit approval.
5. During the work, capture only useful Lab 3 evidence/screenshots that correspond to the lab requirements and store working evidence under `pic/pic_lab3/` with descriptive names.
6. Apply the real PR #43 peer-review feedback to the Engineering Contract: restore the handout's BR-01..BR-05 meanings, make migration/provisioning deterministic, define Ticket-create idempotency, make Test ID-to-file mappings explicit, align the Attachment DTO contract, and keep approval/merge evidence pending until it actually occurs.
7. Apply the real PR #45 Issue 2 review blockers: reconcile the custom data-preserving Lab 3 migration with Prisma migration history and clean deployment, make malformed scrypt hashes fail closed with negative tests, and strengthen migration/seed invariants to match MIG-01/MIG-02 before requesting re-review.
8. Implement Issue #35 Authentication Foundation only after re-reading the Lab 3 contract: write the planned authentication/UI tests first, confirm a legitimate red state, then implement only login/current-user/logout/change-password, session/CSRF/throttle behavior, and the authenticated shell without pulling Issue #36 Requester authorization/regression work forward.
9. Apply PR #46 review feedback by enforcing the mandatory first-login password-change gate at a real exported production application route and replacing the isolated throwaway-route test with production-app integration evidence, without pulling Issue #36 Requester ownership/authorization into Issue #35.

The final file should retain only 6-10 representative prompts that best demonstrate specification-agent and coding-agent use.

## My Reflection

Pending until the Sprint 3 implementation/review cycle provides enough real evidence for a meaningful reflection.
