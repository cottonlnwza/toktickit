import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import {
  FRONTEND_ORIGIN,
  cleanupIssue36Fixtures,
  fixtureUsers,
  issue36ReferenceData,
  loginIssue36,
  provisionIssue36User,
} from "./requester-test-helpers.js";

describe("Lab 3 Lab 1/Lab 2 regression under authenticated identity", () => {
  beforeEach(async () => {
    await cleanupIssue36Fixtures();
    await provisionIssue36User(fixtureUsers.requesterA);
  });

  afterAll(async () => {
    await cleanupIssue36Fixtures();
    await getPrisma().$disconnect();
  });

  it("REG-01 keeps reference data plus create/list/detail/Attachment continuity on the authenticated production routes", async () => {
    const prisma = getPrisma();
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const { category, relatedSystem } = await issue36ReferenceData();
    const { agent, response: login } = await loginIssue36(fixtureUsers.requesterA);

    const categories = await agent.get("/api/categories").set("Origin", FRONTEND_ORIGIN);
    const systems = await agent.get("/api/related-systems").set("Origin", FRONTEND_ORIGIN);
    expect(categories.status).toBe(200);
    expect(systems.status).toBe(200);
    expect(categories.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: category.id, name: category.name })]));
    expect(systems.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: relatedSystem.id, name: relatedSystem.name })]));

    const create = await agent
      .post("/api/tickets")
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({
        clientRequestId: randomUUID(),
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Lab 2 regression Ticket under Lab 3",
        description: "This regression verifies the preserved Requester create/list/detail/Attachment workflow under authenticated identity.",
        requestedPriority: "MEDIUM",
      });
    expect(create.status).toBe(201);
    expect(create.body.requesterId).toBe(requester.id);

    const upload = await agent
      .post(`/api/tickets/${create.body.id}/attachments`)
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", login.body.csrfToken)
      .attach("file", Buffer.from("regression-pdf"), { filename: "regression.pdf", contentType: "application/pdf" });
    expect(upload.status).toBe(201);
    expect(upload.body).toMatchObject({ ticketId: create.body.id, originalFilename: "regression.pdf", state: "active" });
    expect(upload.body).not.toHaveProperty("storagePath");

    const list = await agent.get(`/api/tickets/mine?search=${encodeURIComponent(create.body.ticketNumber)}`).set("Origin", FRONTEND_ORIGIN);
    expect(list.status).toBe(200);
    expect(list.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: create.body.id, ticketNumber: create.body.ticketNumber })]));

    const detail = await agent.get(`/api/tickets/${create.body.id}`).set("Origin", FRONTEND_ORIGIN);
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      id: create.body.id,
      requester: { id: requester.id, email: requester.email },
      attachments: [expect.objectContaining({ id: upload.body.id, originalFilename: "regression.pdf", state: "active" })],
    });
    expect(JSON.stringify(detail.body)).not.toMatch(/passwordHash|tokenHash|csrfTokenHash|storagePath/i);

    const download = await agent.get(`/api/tickets/${create.body.id}/attachments/${upload.body.id}/download`).set("Origin", FRONTEND_ORIGIN);
    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toContain("application/pdf");
  });

  it("REG-01 keeps another Requester from discovering the regression Ticket", async () => {
    const prisma = getPrisma();
    await provisionIssue36User(fixtureUsers.requesterB);
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: fixtureUsers.requesterA.email } });
    const { category, relatedSystem } = await issue36ReferenceData();
    const { agent: ownerAgent, response: ownerLogin } = await loginIssue36(fixtureUsers.requesterA);
    const create = await ownerAgent
      .post("/api/tickets")
      .set("Origin", FRONTEND_ORIGIN)
      .set("X-CSRF-Token", ownerLogin.body.csrfToken)
      .send({
        clientRequestId: randomUUID(),
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: "Private regression Ticket",
        description: "Cross-Requester regression must keep the historical Ticket workflow private to the authenticated owner.",
        requestedPriority: "LOW",
      });
    expect(create.status).toBe(201);
    expect(create.body.requesterId).toBe(requester.id);

    const { agent: otherAgent } = await loginIssue36(fixtureUsers.requesterB);
    const detail = await otherAgent.get(`/api/tickets/${create.body.id}`).set("Origin", FRONTEND_ORIGIN);
    expect(detail.status).toBe(404);
    expect(JSON.stringify(detail.body)).not.toContain(create.body.ticketNumber);
  });
});
