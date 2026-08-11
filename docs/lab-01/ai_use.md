# Lab 1 — AI Use and Reflection

**LLM/agent used:** Codex and ChatGPT

## Selected AI Prompts

### Prompt 1 — Issue #2 Planning With Scope Lock

**Prompt text**
> We are now working ONLY on Issue #2: Health Check. Do NOT modify any file yet. Inspect the repository first, including the backend health route, Express structure, frontend Check System button, API call logic, status display, and Vitest/Supertest tests. Then respond with A-I analysis and stop.

**Purpose**
I used this prompt to force inspection before implementation and keep the work limited to Issue #2.

**What I did with the result**
I reviewed the plan before allowing edits, then used it to confirm which files were actually needed.

### Prompt 2 — Issue #2 Minimum Implementation And Verification

**Prompt text**
> Implement ONLY Issue #2: Health Check. Modify only server/src/app.ts, client/src/api.ts, and client/src/App.tsx. Do not implement category logic. After changes, show files changed, explain changes, show important code sections, and run server tests/build and client tests/build. Do not commit or push.

**Purpose**
I used this prompt to implement the health endpoint and frontend health check while preventing Issue #3/#4 work from leaking in.

**What I did with the result**
I checked the changed files and verified the reported test/build results before collecting evidence.

### Prompt 3 — Issue #3 Category Database And Seed

**Prompt text**
> Implement ONLY Issue #3: Category Database + Seed. Do NOT implement /api/categories or frontend category fetching. Add the Category model, seed exactly Account and Access, Hardware, Software, and Network. Use Prisma upsert so the seed is idempotent. Run prisma validate, migration, seed twice, duplicate verification, server build, and existing tests.

**Purpose**
I used this prompt to separate database/schema work from API/UI work.

**What I did with the result**
I verified the migration and seed behavior, including running the seed twice and checking that duplicate categories were not created.

### Prompt 4 — Issue #4 Planning Before Editing

**Prompt text**
> Start ONLY Issue #4: Display the IT Request Category List. Do NOT modify files yet. Inspect server app, Prisma helper, category tests, frontend API, App component, and frontend tests. Report A-I only. No authentication, ticket creation, image upload, Playwright, unrelated refactoring, new dependencies, or pic/ changes.

**Purpose**
I used this prompt to get a scoped implementation plan before touching code.

**What I did with the result**
I approved the plan only after confirming it matched the instructor requirements and reused the existing Issue #3 seed/model.

### Prompt 5 — Issue #4 Implementation With Tests

**Prompt text**
> Implement ONLY Issue #4. Add GET /api/categories through Prisma, return id and name ordered by id, use a safe 500 error, implement Supertest, fetch health then categories in client API, render Online categories and Offline error in App, mock checkSystem in Vitest, run server/client tests and builds, and manually verify Online and Offline behavior.

**Purpose**
I used this prompt to implement the category list end to end while requiring automated and manual verification.

**What I did with the result**
I reviewed the code, checked server/client test and build output, and manually verified both backend available and backend unavailable UI states.

### Prompt 6 — Screenshot Submission Evidence Review

**Prompt text**
> Review all new screenshots in pic/pic_lab1 using Screenshot / Submission Evidence Review Mode. For each image, mark PASS / CONDITIONAL PASS / FAIL, identify the Issue and Submission Part, explain what it proves and what is missing, and recommend Keep / Retake / Supporting only. Rename only PASS images using the established naming convention. Do not modify code or delete screenshots.

**Purpose**
I used this prompt to make evidence selection systematic instead of keeping every screenshot.

**What I did with the result**
I kept final and supporting screenshots, retook weak evidence when needed, and avoided using screenshots that were unclear or showed outdated code.

### Prompt 7 — Reviewer Evidence Verification From GitHub

**Prompt text**
> Complete reviewer.md using only real GitHub review history. Do not invent reviewer names, PR links, approvals, comments, or responses. Search GitHub for PRs authored by @Tanaboonnnnn that were reviewed/commented/approved by @cottonlnwza. Use GitHub API/CLI if available. Report exact PR URLs, review verdicts, comments, partner responses, evidence sources, and anything unverified.

**Purpose**
I used this prompt because peer-review history had to be factual and could not be assumed from memory.

**What I did with the result**
I corrected the documentation approach when GitHub evidence did not show reciprocal review yet, then updated it only after the reciprocal review was completed.

### Prompt 8 — Final Test Documentation Preparation

**Prompt text**
> Work ONLY on docs/lab-01/tests.md. Inspect the current file, server health/category tests, client App test, and package.json scripts. Use only actual Lab 1 tests that currently exist. Use verified final-main results exactly: server 2 test files passed, 2 tests passed, build tsc passed; client 1 test file passed, 3 tests passed, build tsc && vite build passed. Stop after proposing content.

**Purpose**
I used this prompt to document test evidence without inventing extra tests or rerunning results into a different record.

**What I did with the result**
I reviewed the proposed table and verified that it matched the real test files and final reported results before approving the edit.

## Reflection

Using narrow prompts with explicit issue boundaries helped me keep AI changes within the required Lab 1 scope. I found that “inspect first,” “do not modify,” and “stop for approval” instructions made the workflow easier to control. I still verified test results and GitHub review history manually because AI output could not be accepted without checking the real repository state.
