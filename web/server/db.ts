import { and, desc, eq, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertLedgerRecord, InsertUser, ledgerRecords, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listLedgerRecords(ownerUserId: number, search?: string) {
  const db = await getDb();
  if (!db) return [];
  const ownerFilter = eq(ledgerRecords.ownerUserId, ownerUserId);
  const filter = search?.trim()
    ? and(ownerFilter, like(ledgerRecords.userId, `%${search.trim()}%`))
    : ownerFilter;
  return db.select().from(ledgerRecords).where(filter).orderBy(desc(ledgerRecords.occurredAt));
}

export async function findLedgerClaim(ownerUserId: number, userId: string, ecoAction: string, excludeId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  const filters = [eq(ledgerRecords.ownerUserId, ownerUserId), eq(ledgerRecords.userId, userId), eq(ledgerRecords.ecoAction, ecoAction)];
  if (excludeId) filters.push(eq(ledgerRecords.id, excludeId));
  const result = await db.select().from(ledgerRecords).where(and(...filters)).limit(1);
  return result[0];
}

export async function createLedgerRecord(record: InsertLedgerRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(ledgerRecords).values(record);
  return Number(result[0].insertId);
}

export async function updateLedgerRecord(ownerUserId: number, id: number, changes: Partial<InsertLedgerRecord>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(ledgerRecords).set(changes).where(and(eq(ledgerRecords.id, id), eq(ledgerRecords.ownerUserId, ownerUserId)));
}

export async function deleteLedgerRecord(ownerUserId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(ledgerRecords).where(and(eq(ledgerRecords.id, id), eq(ledgerRecords.ownerUserId, ownerUserId)));
}
