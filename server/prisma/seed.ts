import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient, RequestedPriority, TicketStatus, UserRole } from "@prisma/client";
import { getPrisma } from "../src/prisma.js";
import { hashPassword } from "../src/auth/password.js";

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

    const seededTickets = [];
    for (const fixture of ticketFixtures) {
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
      }));
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

    console.log(
      `Seeded Lab 3 reference data, ${requesterFixtures.length} Requester fixtures, ${staffFixtures.length} IT Staff fixtures, ${adminFixtures.length} Administrator fixture, and ${ticketFixtures.length} Lab 3 Tickets.`,
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
