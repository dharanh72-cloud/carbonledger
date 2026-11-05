import { createHash } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createLedgerRecord, deleteLedgerRecord, findLedgerClaim, listLedgerRecords, updateLedgerRecord } from "./db";

const recordInput = z.object({
  userId: z.string().trim().min(1).max(80).regex(/^\S+$/, "User ID cannot contain spaces"),
  userName: z.string().trim().min(1).max(160),
  ecoAction: z.string().trim().min(1).max(160),
  projectCategory: z.string().trim().min(1).max(120),
  co2Benefit: z.number().int().min(0).max(1_000_000),
  fundAmount: z.number().int().min(0).max(1_000_000_000),
  occurredAt: z.number().int().positive(),
  notes: z.string().trim().max(5000).optional().nullable(),
});

function normalizeAction(value: string) { return value.trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/_+/g, "_"); }

function leafHash(input: z.infer<typeof recordInput>) {
  return createHash("sha256").update(JSON.stringify({ ...input, notes: input.notes ?? "" })).digest("hex");
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  ledger: router({
    list: protectedProcedure.input(z.object({ search: z.string().optional() }).optional()).query(({ ctx, input }) =>
      listLedgerRecords(ctx.user.id, input?.search),
    ),
    create: protectedProcedure.input(recordInput).mutation(async ({ ctx, input }) => {
      const normalized = { ...input, ecoAction: normalizeAction(input.ecoAction) };
      const duplicate = await findLedgerClaim(ctx.user.id, normalized.userId, normalized.ecoAction);
      if (duplicate) throw new TRPCError({ code: "CONFLICT", message: "Duplicate claim rejected: this user has already logged this eco-action." });
      const id = await createLedgerRecord({ ...normalized, ownerUserId: ctx.user.id, leafHash: leafHash(normalized) });
      return { id };
    }),
    update: protectedProcedure.input(recordInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const { id, ...changes } = input;
      const normalized = { ...changes, ecoAction: normalizeAction(changes.ecoAction) };
      const duplicate = await findLedgerClaim(ctx.user.id, normalized.userId, normalized.ecoAction, id);
      if (duplicate) throw new TRPCError({ code: "CONFLICT", message: "Duplicate claim rejected: this user has already logged this eco-action." });
      await updateLedgerRecord(ctx.user.id, id, { ...normalized, leafHash: leafHash(normalized) });
      return { success: true } as const;
    }),
    remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await deleteLedgerRecord(ctx.user.id, input.id);
      return { success: true } as const;
    }),
    summary: protectedProcedure.query(async ({ ctx }) => {
      const records = await listLedgerRecords(ctx.user.id);
      return {
        records: records.length,
        totalCo2: records.reduce((sum, record) => sum + record.co2Benefit, 0),
        totalFund: records.reduce((sum, record) => sum + record.fundAmount, 0),
        users: new Set(records.map((record) => record.userId)).size,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
