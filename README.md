# TokTickIT

TokTickIT is the Lab 1 full-stack starter project for the CPE334 Software
Engineering course.

## Lab 1 Technology Stack

- Frontend: React, TypeScript, Vite, Bootstrap
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL with Prisma ORM
- API style: REST
- Testing: Vitest and Supertest

## Project Structure

- `client/` contains the React frontend application.
- `server/` contains the Express backend API and Prisma setup.
- `docs/lab-01/` contains Lab 1 documentation and evidence notes.

## Local Setup

Install frontend dependencies:

```bash
cd client
npm install
```

Install backend dependencies:

```bash
cd server
npm install
```

Create local environment files from the examples:

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

The real `.env` files are for local development only and must not be committed.

## Running The App

Start the backend API:

```bash
cd server
npm run dev
```

Start the frontend app in a separate terminal:

```bash
cd client
npm run dev
```

## Database And Prisma

The Prisma schema is located at `server/prisma/schema.prisma`.

The backend uses the `DATABASE_URL` value from `server/.env` to connect to
PostgreSQL.

## Testing

Run frontend tests:

```bash
cd client
npm test
```

Run backend tests:

```bash
cd server
npm test
```

## Issue Scope

Issue #1 establishes the project foundation only. Health check behavior,
category database setup, category seed data, and category list UI behavior are
implemented in later Lab 1 issues.
