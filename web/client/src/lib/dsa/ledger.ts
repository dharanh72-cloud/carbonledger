import { sha256Hex } from "./sha256";
import { checkLedger, type CheckResult } from "./merkle";
import { AVLTree } from "./avl";
import { HashTable } from "./hashTable";
import { Trie } from "./trie";
import { MaxHeap } from "./maxHeap";

/** Eco-action catalogue (kg CO2 per action), identical to the C version's catalogue. */
export const ACTION_CATALOG: Record<string, number> = {
  solar_panel_installed: 120,
  tree_planted: 21.5,
  led_bulbs_switch: 8,
  bicycle_commute: 3.2,
  compost_started: 15,
  rainwater_harvesting: 10,
};

export const catalogTrie = (() => {
  const trie = new Trie<number>();
  for (const [action, co2] of Object.entries(ACTION_CATALOG)) trie.insert(action, co2);
  return trie;
})();

/** A record in the simulator's in-memory demo ledger. */
export interface DemoRecord {
  id: string;
  userId: string;
  userName: string;
  ecoAction: string;
  co2Benefit: number;
  /** CO2 value at commit time, kept so a tamper report can show old vs new. */
  trustedCo2: number;
  /** Leaf hash fixed at commit time; never recomputed. */
  leafHash: string;
}

type LeafSource = Pick<DemoRecord, "id" | "userId" | "userName" | "ecoAction" | "co2Benefit">;

/** Leaf hash computed from a record's current field values. */
export function demoLeaf(r: LeafSource): string {
  return sha256Hex(`${r.id}|${r.userId}|${r.userName}|${r.ecoAction}|${r.co2Benefit.toFixed(2)}`);
}

export function makeDemoRecord(n: number, userId: string, userName: string, ecoAction: string, co2: number): DemoRecord {
  const base = { id: `CL-${String(n).padStart(4, "0")}`, userId, userName, ecoAction, co2Benefit: co2 };
  return { ...base, trustedCo2: co2, leafHash: demoLeaf(base) };
}

const DEMO_USERS: Array<[string, string]> = [
  ["maya", "Maya Chen"], ["rohan", "Rohan Patel"], ["amina", "Amina Okafor"], ["kenji", "Kenji Sato"],
  ["sofia", "Sofia Rossi"], ["liam", "Liam Murphy"], ["priya", "Priya Nair"], ["noah", "Noah Adler"],
];

/**
 * Deterministic 36-record ledger the simulator starts from: eight users each claiming a
 * different subset of the six catalogued actions. Large enough that localising one tampered
 * record visibly costs ~log2(n) node comparisons rather than n.
 */
export function seedDemoLedger(): DemoRecord[] {
  const records: DemoRecord[] = [];
  Object.keys(ACTION_CATALOG).forEach((action, a) => {
    DEMO_USERS.forEach(([userId, userName], u) => {
      if ((u + 2 * a) % 4 !== 3) records.push(makeDemoRecord(records.length + 1, userId, userName, action, ACTION_CATALOG[action]));
    });
  });
  return records;
}

/** Merkle check: leaves fixed at commit time vs leaves recomputed from live field values. */
export function checkDemo(records: DemoRecord[]): CheckResult {
  return checkLedger(records.map((r) => r.leafHash), records.map(demoLeaf));
}

/** Hash table of every "user|action" claim already on the ledger. */
export function demoClaims(records: DemoRecord[]): HashTable<string> {
  const claims = new HashTable<string>();
  for (const r of records) claims.set(`${r.userId}|${r.ecoAction}`, r.id);
  return claims;
}

/** AVL registry of per-user CO2 totals, ranked with a max-heap. */
export function demoLeaderboard(records: DemoRecord[], k: number) {
  const registry = new AVLTree<{ userId: string; userName: string; co2: number }>();
  for (const r of records) {
    registry.upsert(r.userId, (row) => {
      const next = row ?? { userId: r.userId, userName: r.userName, co2: 0 };
      next.co2 += r.co2Benefit;
      return next;
    });
  }
  const heap = MaxHeap.from(registry.inorder().map(([, row]) => ({ priority: row.co2, value: row })));
  return {
    rows: heap.topK(k).map((e) => e.value),
    users: registry.size,
    height: registry.height,
    rotations: registry.rotations,
  };
}

export const shortRoot = (root: string) => (root ? `${root.slice(0, 4)}...${root.slice(-4)}` : "empty");
export const groupRoot = (root: string) => (root ? (root.slice(0, 16).match(/.{4}/g) ?? []).join(" ") : "0000 0000 0000 0000");
