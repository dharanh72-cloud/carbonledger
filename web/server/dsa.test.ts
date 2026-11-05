import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  AVLTree, HashTable, MaxHeap, Trie, buildMerkle, checkLedger, checkDemo, demoClaims, demoLeaderboard,
  knapsackBranchAndBound, knapsackDP, knapsackGreedy, makeDemoRecord, seedDemoLedger, sha256Hex, catalogTrie,
} from "../client/src/lib/dsa";

const leaves = (n: number) => Array.from({ length: n }, (_, i) => sha256Hex(`record-${i}`));

describe("sha256", () => {
  it("matches published test vectors", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("agrees with node's crypto on strings of many lengths, including multi-block and unicode", () => {
    for (const len of [1, 55, 56, 63, 64, 65, 119, 120, 1000]) {
      const s = "é₹x".repeat(len);
      expect(sha256Hex(s)).toBe(createHash("sha256").update(s, "utf8").digest("hex"));
    }
  });
});

describe("merkle tree", () => {
  it("reports an untouched ledger as intact after a single root comparison", () => {
    const l = leaves(100);
    const r = checkLedger(l, [...l]);
    expect(r.ok).toBe(true);
    expect(r.tampered).toEqual([]);
    expect(r.visited).toBe(1);
  });

  it("pinpoints every single-leaf tamper position for odd and even sizes", () => {
    for (const n of [1, 2, 3, 5, 8, 13, 64, 100]) {
      for (let i = 0; i < n; i++) {
        const live = leaves(n);
        live[i] = sha256Hex("tampered");
        const r = checkLedger(leaves(n), live);
        expect(r.ok).toBe(false);
        expect(r.tampered).toEqual([i]);
      }
    }
  });

  it("localises one tampered record in O(log n) node comparisons", () => {
    const n = 4096;
    const live = leaves(n);
    live[2718] = sha256Hex("tampered");
    const r = checkLedger(leaves(n), live);
    expect(r.tampered).toEqual([2718]);
    expect(r.visited).toBeLessThanOrEqual(2 * Math.log2(n) + 1);
  });

  it("finds multiple tampered leaves", () => {
    const live = leaves(50);
    live[3] = "x"; live[40] = "y";
    expect(checkLedger(leaves(50), live).tampered).toEqual([3, 40]);
  });

  it("flags records added or removed outside the commit path", () => {
    expect(checkLedger(leaves(5), leaves(4)).countMismatch).toBe(true);
    expect(checkLedger(leaves(5), leaves(4)).ok).toBe(false);
  });

  it("changes the root when any leaf changes, and has no root when empty", () => {
    expect(buildMerkle([])).toBeNull();
    const a = buildMerkle(leaves(7))!.hash;
    const l = leaves(7); l[6] = "z";
    expect(buildMerkle(l)!.hash).not.toBe(a);
  });
});

describe("AVL tree", () => {
  it("stays logarithmic under sorted insertion, where a plain BST degenerates to a list", () => {
    const tree = new AVLTree<number>();
    const n = 2000;
    for (let i = 0; i < n; i++) tree.upsert(String(i).padStart(6, "0"), () => i);
    expect(tree.size).toBe(n);
    expect(tree.height).toBeLessThanOrEqual(Math.ceil(1.45 * Math.log2(n + 2)));
    expect(tree.height).toBeLessThan(20);
    expect(tree.rotations).toBeGreaterThan(0);
  });

  it("keeps keys sorted, updates in place, and supports lookup", () => {
    const tree = new AVLTree<number>();
    for (const k of ["m", "c", "x", "a", "d", "z", "b"]) tree.upsert(k, (v) => (v ?? 0) + 1);
    tree.upsert("m", (v) => (v ?? 0) + 10);
    expect(tree.inorder().map(([k]) => k)).toEqual(["a", "b", "c", "d", "m", "x", "z"]);
    expect(tree.get("m")).toBe(11);
    expect(tree.get("nope")).toBeUndefined();
    expect(tree.size).toBe(7);
  });

  it("records which rotation case fired", () => {
    const rr = new AVLTree<number>();
    ["a", "b", "c"].forEach((k) => rr.upsert(k, () => 1));
    expect(rr.lastRotation).toBe("RR");
    const rl = new AVLTree<number>();
    ["a", "c", "b"].forEach((k) => rl.upsert(k, () => 1));
    expect(rl.lastRotation).toBe("RL");
    const ll = new AVLTree<number>();
    ["c", "b", "a"].forEach((k) => ll.upsert(k, () => 1));
    expect(ll.lastRotation).toBe("LL");
    const lr = new AVLTree<number>();
    ["c", "a", "b"].forEach((k) => lr.upsert(k, () => 1));
    expect(lr.lastRotation).toBe("LR");
  });
});

describe("hash table", () => {
  it("handles collisions with chaining and grows without losing keys", () => {
    const t = new HashTable<number>(2);
    for (let i = 0; i < 500; i++) t.set(`key-${i}`, i);
    expect(t.size).toBe(500);
    for (let i = 0; i < 500; i++) expect(t.get(`key-${i}`)).toBe(i);
    expect(t.has("missing")).toBe(false);
    expect(t.loadFactor).toBeLessThanOrEqual(0.75);
    t.set("key-7", 777);
    expect(t.get("key-7")).toBe(777);
    expect(t.size).toBe(500);
  });
});

describe("trie", () => {
  it("looks up and autocompletes by prefix", () => {
    expect(catalogTrie.lookup("tree_planted")).toBe(21.5);
    expect(catalogTrie.lookup("tree")).toBeUndefined();
    expect(catalogTrie.autocomplete("sol").map(([w]) => w)).toEqual(["solar_panel_installed"]);
    expect(catalogTrie.autocomplete("zzz")).toEqual([]);
    expect(catalogTrie.autocomplete("").length).toBe(6);
    const t = new Trie<number>();
    t.insert("car", 1); t.insert("card", 2); t.insert("care", 3);
    expect(t.autocomplete("car").map(([w]) => w)).toEqual(["car", "card", "care"]);
    expect(t.size).toBe(3);
  });
});

describe("max-heap", () => {
  it("heapifies and pops in descending order with deterministic tie-breaks", () => {
    const values = [5, 1, 9, 3, 9, 7, 2];
    const heap = MaxHeap.from(values.map((v, i) => ({ priority: v, value: i })));
    const out: number[] = [];
    const ties: number[] = [];
    let e;
    while ((e = heap.pop())) { out.push(e.priority); if (e.priority === 9) ties.push(e.value); }
    expect(out).toEqual([9, 9, 7, 5, 3, 2, 1]);
    expect(ties).toEqual([2, 4]);
  });
  it("topK does not consume the heap", () => {
    const heap = MaxHeap.from([3, 8, 1, 6].map((v) => ({ priority: v, value: v })));
    expect(heap.topK(2).map((e) => e.value)).toEqual([8, 6]);
    expect(heap.size).toBe(4);
  });
});

describe("knapsack", () => {
  const projects = [
    { name: "Solar panels", cost: 200, co2: 850 },
    { name: "Tree drive", cost: 40, co2: 120 },
    { name: "LED retrofit", cost: 60, co2: 300 },
    { name: "Rainwater", cost: 150, co2: 180 },
    { name: "EV charging", cost: 180, co2: 400 },
    { name: "Compost unit", cost: 90, co2: 260 },
  ];

  it("reproduces the C version's budget-150 result: DP = B&B = 560, greedy = 420", () => {
    expect(knapsackDP(projects, 150).benefit).toBe(560);
    expect(knapsackBranchAndBound(projects, 150).benefit).toBe(560);
    expect(knapsackGreedy(projects, 150).benefit).toBe(420);
  });

  it("DP and branch-and-bound agree with brute force on random instances, greedy never beats them", () => {
    let seed = 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let trial = 0; trial < 60; trial++) {
      const items = Array.from({ length: 10 }, () => ({ cost: 1 + Math.floor(rnd() * 40), co2: 1 + Math.floor(rnd() * 100) }));
      const budget = 20 + Math.floor(rnd() * 120);
      let brute = 0;
      for (let mask = 0; mask < 1 << items.length; mask++) {
        let c = 0, b = 0;
        items.forEach((it, i) => { if (mask & (1 << i)) { c += it.cost; b += it.co2; } });
        if (c <= budget && b > brute) brute = b;
      }
      const dp = knapsackDP(items, budget);
      const bb = knapsackBranchAndBound(items, budget);
      expect(dp.benefit).toBe(brute);
      expect(bb.benefit).toBe(brute);
      expect(dp.cost).toBeLessThanOrEqual(budget);
      expect(bb.cost).toBeLessThanOrEqual(budget);
      expect(knapsackGreedy(items, budget).benefit).toBeLessThanOrEqual(brute);
    }
  });

  it("prunes: branch-and-bound visits far fewer than 2^n nodes", () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ cost: 5 + ((i * 7) % 23), co2: 10 + ((i * 13) % 37) }));
    const r = knapsackBranchAndBound(items, 60);
    expect(r.explored).toBeLessThan(2 ** 20 / 10);
    expect(r.pruned).toBeGreaterThan(0);
  });
});

describe("demo ledger", () => {
  it("is large enough to show the log-n effect, intact when seeded, and localises a tampered record exactly", () => {
    const records = seedDemoLedger();
    expect(records.length).toBeGreaterThanOrEqual(32);
    expect(new Set(records.map((r) => `${r.userId}|${r.ecoAction}`)).size).toBe(records.length);
    expect(checkDemo(records).ok).toBe(true);
    const tampered = records.map((r, i) => (i === 2 ? { ...r, co2Benefit: 999 } : r));
    const r = checkDemo(tampered);
    expect(r.ok).toBe(false);
    expect(r.tampered).toEqual([2]);
    expect(r.visited).toBeLessThanOrEqual(2 * Math.ceil(Math.log2(records.length)) + 1);
    expect(r.visited).toBeLessThan(records.length / 2);
    expect(tampered[2].trustedCo2).toBe(records[2].co2Benefit);
  });

  it("rejects duplicate claims via the hash table and ranks users via AVL + heap", () => {
    const records = seedDemoLedger();
    expect(demoClaims(records).has("maya|solar_panel_installed")).toBe(true);
    expect(demoClaims(records).has("joyboy|tree_planted")).toBe(false);
    const withJoy = [...records, makeDemoRecord(records.length + 1, "joyboy", "Joy Boy", "tree_planted", 21.5)];
    const board = demoLeaderboard(withJoy, 20);
    expect(board.users).toBe(9);
    expect(board.rows.length).toBe(9);
    for (let i = 1; i < board.rows.length; i++) expect(board.rows[i - 1].co2).toBeGreaterThanOrEqual(board.rows[i].co2);
    expect(board.rows.reduce((s, r) => s + r.co2, 0)).toBeCloseTo(withJoy.reduce((s, r) => s + r.co2Benefit, 0));
  });
});
