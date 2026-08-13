# Lab 1 — Test Plan and Evidence

All test files live under server/tests/lab-01/ and client/tests/lab-01/.

| # | Tool | Test | Result |
|---|------|------|--------|
| 1 | Supertest | GET /api/health returns HTTP 200 with `{ status: "ok", service: "TokTickIT API" }` | Passed |
| 2 | Supertest | GET /api/categories returns the four seeded categories in id order with `id` and `name` | Passed |
| 3 | Vitest | App renders the TokTickIT heading | Passed |
| 4 | Vitest | Check System success state shows Online and the expected category list | Passed |
| 5 | Vitest | Check System failure state shows Offline and a useful error message | Passed |

## Test Files and Coverage

### Server

#### `server/tests/lab-01/health.test.ts`

This test verifies:

- `GET /api/health`
- HTTP 200 response
- response contains `status: "ok"`
- response contains `service: "TokTickIT API"`

#### `server/tests/lab-01/categories.test.ts`

This test verifies:

- `GET /api/categories`
- HTTP 200 response
- exactly four seeded categories are returned
- categories are returned in predictable id order
- each category contains numeric `id` and string `name`
- expected category names:
  - Account and Access
  - Hardware
  - Software
  - Network

### Client

#### `client/tests/lab-01/App.test.tsx`

The existing Vitest tests verify:

- TokTickIT heading renders
- successful Check System flow shows Online state
- successful flow displays the expected four categories
- failed API request shows Offline state
- a useful error message is displayed when the API is unavailable

## Verification Approach

Automated tests were run on the final `main` branch and were followed by production builds for both server and client. The final application behavior was also manually checked for backend available -> Online + four categories and backend unavailable -> Offline + useful error message.

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

Evidence:
Test #1 และ #2 ผ่าน
![Server test and build evidence](<../../pic/pic_lab1/Screenshot 2569-08-12 at 23.23.31.png>)

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

Evidence:
Test #3 และ #4 และ #5 ผ่าน
![Final test documentation and terminal evidence](<../../pic/pic_lab1/Screenshot 2569-08-12 at 23.23.43.png>)
