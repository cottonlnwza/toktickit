import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import {
  FRONTEND_ORIGIN,
  cleanupIssue36Fixtures,
  createIssue36Ticket,
  fixtureUsers,
  loginIssue36,
  provisionIssue36User,
} from "./requester-test-helpers.js";

describe("Lab 3 authenticated Requester Attachment regression", () => {
  beforeEach(async () => {
    await cleanupIssue36Fixtures();
    await provisionIssue36User(fixtureUsers.requesterA);
  });

  afterAll(async () => {
    await cleanupIssue36Fixtures();
    await getPrisma().$disconnect();
  });

  it("API-12 lists Attachment metadata through the canonical owned-Ticket route with canonical download URLs", async () => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const ticket = await createIssue36Ticket(requester.id);
    const active = await prisma.attachment.create({
      data: {
        ticketId: ticket.id,
        originalFilename: "active.pdf",
        storedFilename: `${randomUUID()}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 15,
        storagePath: "/tmp/issue36-active.pdf",
      },
    });
    await prisma.attachment.create({
      data: {
        ticketId: ticket.id,
        originalFilename: "removed.png",
        storedFilename: `${randomUUID()}.png`,
        mimeType: "image/png",
        sizeBytes: 20,
        storagePath: "/tmp/issue36-removed.png",
        removedAt: new Date(),
        removedByUserId: requester.id,
        removalReason: "No longer relevant",
      },
    });
    const { agent } = await loginIssue36(fixtureUsers.requesterA);

    const response = await agent.get(`/api/tickets/${ticket.id}/attachments`).set("Origin", FRONTEND_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: active.id,
        state: "active",
        downloadUrl: `/api/tickets/${ticket.id}/attachments/${active.id}/download`,
      }),
      expect.objectContaining({ originalFilename: "removed.png", state: "removed", removalReason: "No longer relevant" }),
    ]));
    expect(response.body.find((item: { state: string }) => item.state === "removed")).not.toHaveProperty("downloadUrl");
    expect(JSON.stringify(response.body)).not.toMatch(/storagePath|\/tmp\//i);
  });

  it("API-12 uploads and soft-removes an Attachment through authenticated canonical routes", async () => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const ticket = await createIssue36Ticket(requester.id);
    const { agent, response: login } = await loginIssue36(fixtureUsers.requesterA);

    const upload = await agent
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .attach("file", Buffer.from("issue36-pdf"), { filename: "requester-proof.pdf", contentType: "application/pdf" });
    expect(upload.status).toBe(201);
    expect(upload.body).toMatchObject({
      ticketId: ticket.id,
      originalFilename: "requester-proof.pdf",
      state: "active",
    });
    expect(upload.body).not.toHaveProperty("storagePath");

    const download = await agent
      .get(`/api/tickets/${ticket.id}/attachments/${upload.body.id}/download`)
      .set("Origin", FRONTEND_ORIGIN);
    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toMatch(/application\/pdf/i);
    expect(download.headers["content-disposition"]).toContain("requester-proof.pdf");

    const remove = await agent
      .delete(`/api/tickets/${ticket.id}/attachments/${upload.body.id}`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({ reason: "Duplicate evidence" });
    expect(remove.status).toBe(200);
    expect(remove.body).toMatchObject({ id: upload.body.id, state: "removed", removalReason: "Duplicate evidence" });
    expect(remove.body).not.toHaveProperty("downloadUrl");

    const stored = await prisma.attachment.findUniqueOrThrow({ where: { id: upload.body.id } });
    expect(stored.removedAt).not.toBeNull();
    expect(stored.removedByUserId).toBe(requester.id);

    const removedDownload = await agent
      .get(`/api/tickets/${ticket.id}/attachments/${upload.body.id}/download`)
      .set("Origin", FRONTEND_ORIGIN);
    expect(removedDownload.status).toBe(404);
    expect(removedDownload.body.error?.code).toBe("NOT_FOUND");
  });
});
