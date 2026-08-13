# Lab 1 — AI Use and Reflection

**LLM/agent used:** Codex and ChatGPT

## Selected key prompts (6–10)

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Asked ChatGPT to read the Lab 1 documents and explain the requirements, project scope, and workflow in simple terms. | Used the explanation to understand the lab before starting implementation. |
| 2 | Asked ChatGPT to break each Issue into small steps and generate scoped prompts for Codex. | Used the generated prompts to control Codex step by step. |
| 3 | `Work ONLY on Issue #2. Inspect the repository first. Do NOT modify files yet. Stop after the analysis.` | Reviewed the plan before allowing Codex to make changes. |
| 4 | `Implement ONLY Issue #2: Health Check. Do not implement category logic. Run server/client tests and builds.` | Checked the changed files and verified test/build results. |
| 5 | `Implement ONLY Issue #3: Category Database + Seed. Do NOT implement /api/categories or frontend fetching. Use Prisma upsert and verify seed twice.` | Verified the migration, seed behavior, and that duplicate categories were not created. |
| 6 | `Start ONLY Issue #4. Inspect first. No authentication, ticket creation, image upload, Playwright, or unrelated refactoring.` | Checked that the implementation plan stayed inside the Lab 1 scope. |
| 7 | `Implement ONLY Issue #4. Add GET /api/categories, frontend category fetching, Supertest, Vitest, and verify Online/Offline behavior.` | Reviewed the code, tests, builds, and manually checked both success and failure states. |
| 8 | Asked AI to review screenshots and mark them PASS / CONDITIONAL PASS / FAIL for submission evidence. | Used the result to keep useful screenshots and retake unclear evidence. |
| 9 | Asked AI to complete `reviewer.md` using only real GitHub review history and not invent any review evidence. | Verified review information before adding it to the documentation. |
| 10 | Asked ChatGPT whether `tests.md` was complete and to add content that matched the real test files. | Improved the test documentation without changing the actual test results. |

## Reflection

Clear prompts such as `ONLY Issue #...`, `inspect first`, and `stop for approval` helped keep AI work inside the required scope and made each step easier to verify. I did not accept AI results automatically; for example, I rejected unverified peer-review information and corrected the documentation Git workflow when the branch history was not based on `lab1-staging`. I learned that AI is useful for planning, checking, and implementation, but I still need to verify the repository, tests, builds, and Git history myself.