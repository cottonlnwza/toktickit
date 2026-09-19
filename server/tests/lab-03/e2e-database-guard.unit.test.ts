import { describe, expect, it } from "vitest";
import {
  parsePostgreSqlConnectionTarget,
  validateLab3E2EDatabaseUrl,
} from "../../../e2e/lab-03/database.js";

describe("Lab 3 E2E destructive database guard", () => {
  const developmentUrl = "postgresql://dev_user:dev_password@localhost:5432/toktickit?schema=public";

  it("rejects the exact development URL before any destructive setup can run", () => {
    expect(() => validateLab3E2EDatabaseUrl(developmentUrl, developmentUrl)).toThrow(
      /must never target the normal development DATABASE_URL/i,
    );
  });

  it("rejects the same destructive database target even when credentials or loopback spelling differ", () => {
    const sameDatabaseDifferentCredentials = "postgresql://e2e_user:e2e_password@127.0.0.1:5432/toktickit?schema=e2e";
    expect(() => validateLab3E2EDatabaseUrl(developmentUrl, sameDatabaseDifferentCredentials)).toThrow(
      /must never target the normal development DATABASE_URL/i,
    );
  });

  it("rejects an E2E database whose name does not end in _test", () => {
    expect(() => validateLab3E2EDatabaseUrl(
      developmentUrl,
      "postgresql://e2e_user:e2e_password@localhost:5432/toktickit_e2e",
    )).toThrow(/must end in _test/i);
  });

  it("accepts a separately named _test database and preserves the requested connection URL", () => {
    const isolated = "postgresql://e2e_user:e2e_password@localhost:5432/toktickit_lab3_e2e_test?schema=public";
    expect(validateLab3E2EDatabaseUrl(developmentUrl, isolated)).toBe(isolated);
  });

  it("parses connection identity explicitly while keeping credentials separate from the destructive target", () => {
    expect(parsePostgreSqlConnectionTarget("postgres://E2E_User:p%40ss@LOCALHOST/toktickit_lab3_e2e_test")).toEqual({
      protocol: "postgresql:",
      hostname: "loopback",
      port: "5432",
      database: "toktickit_lab3_e2e_test",
      username: "E2E_User",
    });
  });
});
