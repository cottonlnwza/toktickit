-- Lab 3 uses application code for the data-preserving Requester -> User
-- transformation because every migrated User must receive a freshly generated
-- per-user scrypt hash. SQL alone cannot produce the approved Node scrypt
-- credential format used by the application.
--
-- The documented deployment command is:
--   npm run prisma:deploy:lab3
--
-- That command first lets Prisma apply the Lab 1/Lab 2 migration history,
-- runs the transactional Lab 3 data migration, then reruns `prisma migrate
-- deploy`. At that point this guard succeeds and Prisma records this migration
-- in `_prisma_migrations`, so later migrations do not drift from history.

DO $$
BEGIN
  IF to_regclass('public."User"') IS NULL
     OR to_regclass('public."RequesterUser"') IS NOT NULL THEN
    RAISE EXCEPTION
      'LAB3_DATA_MIGRATION_REQUIRED: run npm run prisma:deploy:lab3 instead of prisma migrate deploy directly';
  END IF;
END $$;
