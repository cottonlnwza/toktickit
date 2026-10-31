import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ActionEventType, ActionStatus, PrismaClient, RequestedPriority, TicketStatus, UserRole } from "@prisma/client";
import { getPrisma } from "../src/prisma.js";
import { hashPassword } from "../src/auth/password.js";
import { createActionFingerprint } from "../src/action-operations.js";

const INITIAL_PASSWORD = "Lab3-ChangeMe-2026";

type SeedUser = {
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};

async function ensureUser(prisma: PrismaClient, user: SeedUser) {
  const email = user.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;

  return prisma.user.create({
    data: {
      ...user,
      name: user.name.trim(),
      email,
      passwordHash: await hashPassword(INITIAL_PASSWORD),
      mustChangePassword: true,
    },
  });
}

export async function seedDatabase(databaseUrl?: string) {
  const ownClient = Boolean(databaseUrl);
  const prisma = databaseUrl
    ? new PrismaClient({ datasources: { db: { url: databaseUrl } } })
    : getPrisma();

  try {
    const lab4Columns = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='Ticket' AND column_name='workflowCycle'
      ) AS "exists"
    `);
    const lab4SchemaAvailable = Boolean(lab4Columns[0]?.exists);
    const categoryNames = ["Account and Access", "Hardware", "Software", "Network"];
    const relatedSystemNames = [
      "Email",
      "Campus Wi-Fi",
      "VPN",
      "LEB2 App",
      "Grade Submission App",
      "Printer",
      "Corporate Laptop",
    ];

    for (const name of categoryNames) {
      await prisma.category.upsert({
        where: { name },
        update: { isActive: true },
        create: { name, isActive: true },
      });
    }

    for (const name of relatedSystemNames) {
      await prisma.relatedSystem.upsert({
        where: { name },
        update: { isActive: true },
        create: { name, isActive: true },
      });
    }

    const requesterFixtures: SeedUser[] = [
      { name: "Anong Student", email: "anong.student@example.test", role: UserRole.REQUESTER, isActive: true },
      { name: "Burin Lecturer", email: "burin.lecturer@example.test", role: UserRole.REQUESTER, isActive: true },
      { name: "Chalida Staff", email: "chalida.staff@example.test", role: UserRole.REQUESTER, isActive: true },
      { name: "Darin Researcher", email: "darin.researcher@example.test", role: UserRole.REQUESTER, isActive: true },
      { name: "Inactive Requester", email: "inactive.requester@example.test", role: UserRole.REQUESTER, isActive: false },
    ];
    const staffFixtures: SeedUser[] = [
      { name: "IT Staff One", email: "it.staff.one@example.test", role: UserRole.IT_STAFF, isActive: true },
      { name: "IT Staff Two", email: "it.staff.two@example.test", role: UserRole.IT_STAFF, isActive: true },
      { name: "IT Staff Three", email: "it.staff.three@example.test", role: UserRole.IT_STAFF, isActive: true },
      { name: "Inactive IT Staff", email: "inactive.it.staff@example.test", role: UserRole.IT_STAFF, isActive: false },
    ];
    const adminFixtures: SeedUser[] = [
      { name: "Lab Administrator", email: "admin@example.test", role: UserRole.ADMINISTRATOR, isActive: true },
    ];

    const requesters = [];
    for (const fixture of requesterFixtures) requesters.push(await ensureUser(prisma, fixture));
    const staff = [];
    for (const fixture of staffFixtures) staff.push(await ensureUser(prisma, fixture));
    const admins = [];
    for (const fixture of adminFixtures) admins.push(await ensureUser(prisma, fixture));

    const hardware = await prisma.category.findUniqueOrThrow({ where: { name: "Hardware" } });
    const software = await prisma.category.findUniqueOrThrow({ where: { name: "Software" } });
    const laptop = await prisma.relatedSystem.findUniqueOrThrow({ where: { name: "Corporate Laptop" } });
    const email = await prisma.relatedSystem.findUniqueOrThrow({ where: { name: "Email" } });

    const ticketFixtures: Array<{
      ticketNumber: string;
      clientRequestId: string;
      requesterId: number;
      categoryId: number;
      relatedSystemId: number;
      summary: string;
      description: string;
      requestedPriority: RequestedPriority;
      itPriority: RequestedPriority;
      currentStatus: TicketStatus;
      ownerId: number | null;
    }> = [
      { ticketNumber: "LAB3-0001", clientRequestId: "10000000-0000-4000-8000-000000000001", requesterId: requesters[0].id, categoryId: hardware.id, relatedSystemId: laptop.id, summary: "Laptop will not charge", description: "The assigned laptop does not charge with the approved adapter.", requestedPriority: RequestedPriority.HIGH, itPriority: RequestedPriority.HIGH, currentStatus: TicketStatus.NEW, ownerId: null },
      { ticketNumber: "LAB3-0002", clientRequestId: "10000000-0000-4000-8000-000000000002", requesterId: requesters[1].id, categoryId: software.id, relatedSystemId: email.id, summary: "Mailbox access issue", description: "The mailbox prompts for credentials repeatedly on campus.", requestedPriority: RequestedPriority.MEDIUM, itPriority: RequestedPriority.HIGH, currentStatus: TicketStatus.OPEN, ownerId: staff[0].id },
      { ticketNumber: "LAB3-0003", clientRequestId: "10000000-0000-4000-8000-000000000003", requesterId: requesters[2].id, categoryId: hardware.id, relatedSystemId: laptop.id, summary: "Dock display flickers", description: "The external display flickers after reconnecting the docking station.", requestedPriority: RequestedPriority.LOW, itPriority: RequestedPriority.MEDIUM, currentStatus: TicketStatus.IN_PROGRESS, ownerId: staff[1].id },
      { ticketNumber: "LAB3-0004", clientRequestId: "10000000-0000-4000-8000-000000000004", requesterId: requesters[3].id, categoryId: software.id, relatedSystemId: email.id, summary: "Need requester confirmation", description: "A configuration change was applied and confirmation is required.", requestedPriority: RequestedPriority.MEDIUM, itPriority: RequestedPriority.MEDIUM, currentStatus: TicketStatus.WAITING_FOR_REQUESTER, ownerId: staff[2].id },
      { ticketNumber: "LAB3-0005", clientRequestId: "10000000-0000-4000-8000-000000000005", requesterId: requesters[0].id, categoryId: hardware.id, relatedSystemId: laptop.id, summary: "Resolved adapter issue", description: "Replacement adapter was tested successfully with the requester.", requestedPriority: RequestedPriority.HIGH, itPriority: RequestedPriority.HIGH, currentStatus: TicketStatus.RESOLVED, ownerId: staff[0].id },
      { ticketNumber: "LAB3-0006", clientRequestId: "10000000-0000-4000-8000-000000000006", requesterId: requesters[1].id, categoryId: software.id, relatedSystemId: email.id, summary: "Closed mailbox request", description: "Mailbox settings were corrected and the request was completed.", requestedPriority: RequestedPriority.LOW, itPriority: RequestedPriority.LOW, currentStatus: TicketStatus.CLOSED, ownerId: staff[1].id },
      { ticketNumber: "LAB3-0007", clientRequestId: "10000000-0000-4000-8000-000000000007", requesterId: requesters[2].id, categoryId: hardware.id, relatedSystemId: laptop.id, summary: "Reopened display issue", description: "The display problem returned after the previous resolution.", requestedPriority: RequestedPriority.HIGH, itPriority: RequestedPriority.URGENT, currentStatus: TicketStatus.REOPENED, ownerId: admins[0].id },
      { ticketNumber: "LAB3-0008", clientRequestId: "10000000-0000-4000-8000-000000000008", requesterId: requesters[3].id, categoryId: software.id, relatedSystemId: email.id, summary: "Cancelled duplicate request", description: "This request duplicates an earlier active support request.", requestedPriority: RequestedPriority.LOW, itPriority: RequestedPriority.LOW, currentStatus: TicketStatus.CANCELLED, ownerId: null },
    ];

    const seededTickets: Array<{ id: number }> = [];
    for (const fixture of ticketFixtures) {
      if (lab4SchemaAvailable) {
        seededTickets.push(await prisma.ticket.upsert({
          where: { ticketNumber: fixture.ticketNumber },
          update: {
            requesterId: fixture.requesterId,
            categoryId: fixture.categoryId,
            relatedSystemId: fixture.relatedSystemId,
            summary: fixture.summary,
            description: fixture.description,
            requestedPriority: fixture.requestedPriority,
            itPriority: fixture.itPriority,
            currentStatus: fixture.currentStatus,
            ownerId: fixture.ownerId,
          },
          create: fixture,
          select: { id: true },
        }));
      } else {
        const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
          `INSERT INTO "Ticket" (
             "ticketNumber", "clientRequestId", "requesterId", "categoryId", "relatedSystemId", "summary", "description",
             "requestedPriority", "itPriority", "currentStatus", "ownerId", "createdAt", "updatedAt"
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::"RequestedPriority",$9::"RequestedPriority",$10::"TicketStatus",$11,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
           ON CONFLICT ("ticketNumber") DO UPDATE SET
             "requesterId"=EXCLUDED."requesterId", "categoryId"=EXCLUDED."categoryId", "relatedSystemId"=EXCLUDED."relatedSystemId",
             "summary"=EXCLUDED."summary", "description"=EXCLUDED."description", "requestedPriority"=EXCLUDED."requestedPriority",
             "itPriority"=EXCLUDED."itPriority", "currentStatus"=EXCLUDED."currentStatus", "ownerId"=EXCLUDED."ownerId"
           RETURNING "id"`,
          fixture.ticketNumber, fixture.clientRequestId, fixture.requesterId, fixture.categoryId, fixture.relatedSystemId,
          fixture.summary, fixture.description, fixture.requestedPriority, fixture.itPriority, fixture.currentStatus, fixture.ownerId,
        );
        seededTickets.push(rows[0]);
      }
    }

    const publicComment = {
      ticketId: seededTickets[1].id,
      authorId: requesters[1].id,
      content: "The issue still occurs after restarting the mail application.",
    };
    const existingComment = await prisma.publicComment.findFirst({ where: publicComment });
    if (!existingComment) await prisma.publicComment.create({ data: publicComment });

    const internalNote = {
      ticketId: seededTickets[1].id,
      authorId: staff[0].id,
      content: "Checked the account configuration and requested a fresh client log.",
    };
    const existingNote = await prisma.internalNote.findFirst({ where: internalNote });
    if (!existingNote) await prisma.internalNote.create({ data: internalNote });

    const actionFixtures = [
      {
        clientRequestId: "20000000-0000-4000-8000-000000000001",
        ticket: seededTickets[1], workflowCycle: 1, createdById: staff[0].id, assigneeId: staff[0].id,
        actionDescription: "Reset mailbox client credentials and retest sign-in.", result: "Mailbox sign-in succeeds after credential reset.",
        status: ActionStatus.COMPLETED, followUpRequired: false, followUpNote: null, attachmentNotes: null,
        performedById: staff[0].id, completedAt: new Date("2026-10-01T03:00:00.000Z"), cancelledAt: null,
      },
      {
        clientRequestId: "20000000-0000-4000-8000-000000000002",
        ticket: seededTickets[2], workflowCycle: 1, createdById: staff[1].id, assigneeId: staff[1].id,
        actionDescription: "Inspect dock cable and display connection.", result: null,
        status: ActionStatus.IN_PROGRESS, followUpRequired: true, followUpNote: "Retest after replacing the cable.", attachmentNotes: "See dock photo in Ticket Attachments.",
        performedById: null, completedAt: null, cancelledAt: null,
      },
      {
        clientRequestId: "20000000-0000-4000-8000-000000000003",
        ticket: seededTickets[2], workflowCycle: 1, createdById: staff[1].id, assigneeId: staff[2].id,
        actionDescription: "Prepare replacement display cable.", result: null,
        status: ActionStatus.PLANNED, followUpRequired: false, followUpNote: null, attachmentNotes: null,
        performedById: null, completedAt: null, cancelledAt: null,
      },
      {
        clientRequestId: "20000000-0000-4000-8000-000000000004",
        ticket: seededTickets[6], workflowCycle: 1, createdById: staff[1].id, assigneeId: staff[1].id,
        actionDescription: "Previous-cycle display cable replacement.", result: "Display stable before the issue later returned.",
        status: ActionStatus.COMPLETED, followUpRequired: false, followUpNote: null, attachmentNotes: null,
        performedById: staff[1].id, completedAt: new Date("2026-09-30T03:00:00.000Z"), cancelledAt: null,
      },
      {
        clientRequestId: "20000000-0000-4000-8000-000000000005",
        ticket: seededTickets[6], workflowCycle: 2, createdById: admins[0].id, assigneeId: staff[2].id,
        actionDescription: "Investigate the reopened display issue.", result: null,
        status: ActionStatus.PLANNED, followUpRequired: false, followUpNote: null, attachmentNotes: null,
        performedById: null, completedAt: null, cancelledAt: null,
      },
    ] as const;

    if (lab4SchemaAvailable) {
      await prisma.ticket.update({ where: { id: seededTickets[6].id }, data: { workflowCycle: 2 } });

      for (const fixture of actionFixtures) {
      const fingerprint = createActionFingerprint({
        ticketId: fixture.ticket.id,
        workflowCycle: fixture.workflowCycle,
        createdById: fixture.createdById,
        actionDescription: fixture.actionDescription,
        assigneeId: fixture.assigneeId,
        result: fixture.result,
        followUpRequired: fixture.followUpRequired,
        followUpNote: fixture.followUpNote,
        attachmentNotes: fixture.attachmentNotes,
      });
      const action = await prisma.actionTaken.upsert({
        where: { clientRequestId: fixture.clientRequestId },
        update: {
          ticketId: fixture.ticket.id,
          workflowCycle: fixture.workflowCycle,
          createFingerprint: fingerprint,
          createdById: fixture.createdById,
          actionDescription: fixture.actionDescription,
          result: fixture.result,
          status: fixture.status,
          assigneeId: fixture.assigneeId,
          performedById: fixture.performedById,
          followUpRequired: fixture.followUpRequired,
          followUpNote: fixture.followUpNote,
          attachmentNotes: fixture.attachmentNotes,
          completedAt: fixture.completedAt,
          cancelledAt: fixture.cancelledAt,
          version: 0,
        },
        create: {
          ticketId: fixture.ticket.id,
          workflowCycle: fixture.workflowCycle,
          clientRequestId: fixture.clientRequestId,
          createFingerprint: fingerprint,
          createdById: fixture.createdById,
          actionDescription: fixture.actionDescription,
          result: fixture.result,
          status: fixture.status,
          assigneeId: fixture.assigneeId,
          performedById: fixture.performedById,
          followUpRequired: fixture.followUpRequired,
          followUpNote: fixture.followUpNote,
          attachmentNotes: fixture.attachmentNotes,
          completedAt: fixture.completedAt,
          cancelledAt: fixture.cancelledAt,
          version: 0,
        },
      });
        await prisma.actionTakenEvent.upsert({
        where: { actionTakenId_actionVersion: { actionTakenId: action.id, actionVersion: 0 } },
        update: {
          ticketId: fixture.ticket.id,
          workflowCycle: fixture.workflowCycle,
          eventType: ActionEventType.CREATED,
          actorId: fixture.createdById,
          toStatus: ActionStatus.PLANNED,
          toAssigneeId: fixture.assigneeId,
          ticketVersion: 0,
          changedFields: ["actionDescription", "assigneeId", "result", "followUpRequired", "followUpNote", "attachmentNotes"],
        },
        create: {
          actionTakenId: action.id,
          ticketId: fixture.ticket.id,
          workflowCycle: fixture.workflowCycle,
          eventType: ActionEventType.CREATED,
          actorId: fixture.createdById,
          toStatus: ActionStatus.PLANNED,
          toAssigneeId: fixture.assigneeId,
          actionVersion: 0,
          ticketVersion: 0,
          changedFields: ["actionDescription", "assigneeId", "result", "followUpRequired", "followUpNote", "attachmentNotes"],
        },
        });
      }
    }

    console.log(
      lab4SchemaAvailable
        ? `Seeded Lab 4 reference data, ${requesterFixtures.length} Requester fixtures, ${staffFixtures.length} IT Staff fixtures, ${adminFixtures.length} Administrator fixture, ${ticketFixtures.length} Tickets, and ${actionFixtures.length} Actions Taken.`
        : `Seeded Lab 3-compatible reference data, ${requesterFixtures.length} Requester fixtures, ${staffFixtures.length} IT Staff fixtures, ${adminFixtures.length} Administrator fixture, and ${ticketFixtures.length} Tickets.`,
    );
  } finally {
    if (ownClient) await prisma.$disconnect();
  }
}

async function main() {
  await seedDatabase();
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectExecution) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(async () => {
      await getPrisma().$disconnect();
    });
}
