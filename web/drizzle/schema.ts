import { bigint, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * User-owned eco-action records. occurredAt is stored as UTC Unix milliseconds.
 * leafHash is the record fingerprint used by the integrity view.
 */
export const ledgerRecords = mysqlTable("ledgerRecords", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId").notNull(),
  userId: varchar("userId", { length: 80 }).notNull(),
  userName: varchar("userName", { length: 160 }).notNull(),
  ecoAction: varchar("ecoAction", { length: 160 }).notNull(),
  projectCategory: varchar("projectCategory", { length: 120 }).notNull(),
  co2Benefit: int("co2Benefit").notNull(),
  fundAmount: int("fundAmount").notNull(),
  occurredAt: bigint("occurredAt", { mode: "number" }).notNull(),
  notes: text("notes"),
  leafHash: varchar("leafHash", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  ownerIndex: index("ledgerRecords_ownerUserId_idx").on(table.ownerUserId),
  userIndex: index("ledgerRecords_userId_idx").on(table.userId),
  uniqueClaimIndex: uniqueIndex("ledgerRecords_unique_claim_idx").on(table.ownerUserId, table.userId, table.ecoAction),
}));

export type LedgerRecord = typeof ledgerRecords.$inferSelect;
export type InsertLedgerRecord = typeof ledgerRecords.$inferInsert;
