-- Lab 4 Actions Taken foundation. Existing Lab 1-3 rows are preserved in place.
CREATE TYPE "ActionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ActionEventType" AS ENUM ('CREATED', 'UPDATED', 'STARTED', 'COMPLETED', 'CANCELLED');

ALTER TABLE "Ticket"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "workflowCycle" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "resolvedAt" TIMESTAMP(3);

UPDATE "Ticket"
SET "resolvedAt" = "updatedAt"
WHERE "currentStatus" IN ('RESOLVED'::"TicketStatus", 'CLOSED'::"TicketStatus")
  AND "resolvedAt" IS NULL;

CREATE TABLE "ActionTaken" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "workflowCycle" INTEGER NOT NULL,
  "clientRequestId" TEXT NOT NULL,
  "createFingerprint" TEXT NOT NULL,
  "createdById" INTEGER NOT NULL,
  "actionDescription" TEXT NOT NULL,
  "result" TEXT,
  "status" "ActionStatus" NOT NULL DEFAULT 'PLANNED',
  "assigneeId" INTEGER NOT NULL,
  "performedById" INTEGER,
  "followUpRequired" BOOLEAN NOT NULL,
  "followUpNote" TEXT,
  "attachmentNotes" TEXT,
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActionTakenEvent" (
  "id" SERIAL NOT NULL,
  "actionTakenId" INTEGER NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "workflowCycle" INTEGER NOT NULL,
  "eventType" "ActionEventType" NOT NULL,
  "actorId" INTEGER NOT NULL,
  "fromStatus" "ActionStatus",
  "toStatus" "ActionStatus",
  "fromAssigneeId" INTEGER,
  "toAssigneeId" INTEGER,
  "actionVersion" INTEGER NOT NULL,
  "ticketVersion" INTEGER NOT NULL,
  "changedFields" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActionTakenEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActionTaken_clientRequestId_key" ON "ActionTaken"("clientRequestId");
CREATE INDEX "ActionTaken_ticketId_workflowCycle_createdAt_id_idx" ON "ActionTaken"("ticketId", "workflowCycle", "createdAt", "id");
CREATE INDEX "ActionTaken_assigneeId_status_updatedAt_idx" ON "ActionTaken"("assigneeId", "status", "updatedAt");
CREATE INDEX "ActionTaken_performedById_updatedAt_idx" ON "ActionTaken"("performedById", "updatedAt");
CREATE UNIQUE INDEX "ActionTakenEvent_actionTakenId_actionVersion_key" ON "ActionTakenEvent"("actionTakenId", "actionVersion");
CREATE INDEX "ActionTakenEvent_ticketId_workflowCycle_createdAt_id_idx" ON "ActionTakenEvent"("ticketId", "workflowCycle", "createdAt", "id");
CREATE INDEX "ActionTakenEvent_actorId_createdAt_idx" ON "ActionTakenEvent"("actorId", "createdAt");
CREATE INDEX "Ticket_requesterId_resolvedAt_idx" ON "Ticket"("requesterId", "resolvedAt");

ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTakenEvent" ADD CONSTRAINT "ActionTakenEvent_actionTakenId_fkey" FOREIGN KEY ("actionTakenId") REFERENCES "ActionTaken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTakenEvent" ADD CONSTRAINT "ActionTakenEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTakenEvent" ADD CONSTRAINT "ActionTakenEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTakenEvent" ADD CONSTRAINT "ActionTakenEvent_fromAssigneeId_fkey" FOREIGN KEY ("fromAssigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTakenEvent" ADD CONSTRAINT "ActionTakenEvent_toAssigneeId_fkey" FOREIGN KEY ("toAssigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
