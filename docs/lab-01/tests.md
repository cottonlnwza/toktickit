# Lab 1 — Test Plan and Evidence

All test files live under server/tests/lab-01/ and client/tests/lab-01/.

| # | Tool | Test | Result |
|---|------|------|--------|
| 1 | Supertest | GET /api/health returns HTTP 200 with `{ status: "ok", service: "TokTickIT API" }` | Passed |
| 2 | Supertest | GET /api/categories returns the four seeded categories in id order with `id` and `name` | Passed |
| 3 | Vitest | App renders the TokTickIT heading | Passed |
| 4 | Vitest | Check System success state shows Online and the expected category list | Passed |
| 5 | Vitest | Check System failure state shows Offline and a useful error message | Passed |

## Verified Results On Final main

### Server

Command:

```bash
cd server
npm test
npm run build
```

Result:

```text
Test Files: 2 passed
Tests: 2 passed
Build: tsc passed
```

### Client

Command:

```bash
cd client
npm test
npm run build
```

Result:

```text
Test Files: 1 passed
Tests: 3 passed
Build: tsc && vite build passed
```
