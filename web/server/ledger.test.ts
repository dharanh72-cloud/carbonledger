import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "ledger-test-user",
      email: "ledger@example.com",
      name: "Ledger Test User",
      loginMethod: "test",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("ledger procedures", () => {
  it("rejects incomplete records before any database write", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.ledger.create({
      userId: "sanji",
      userName: "Sanji",
      ecoAction: "",
      projectCategory: "Energy",
      co2Benefit: 8,
      fundAmount: 100,
      occurredAt: Date.now(),
      notes: null,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects invalid record ids for destructive actions", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.ledger.remove({ id: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
