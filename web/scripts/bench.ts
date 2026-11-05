/**
 * Reproducible benchmarks for the TypeScript data-structure library.
 * Run: pnpm bench        (prints Markdown tables)
 */
import { AVLTree, checkLedger, knapsackBranchAndBound, knapsackDP, knapsackGreedy, sha256Hex } from "../client/src/lib/dsa";

const ms = (f: () => void) => { const t = performance.now(); f(); return performance.now() - t; };
const fmt = (n: number) => (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2));

console.log(`Node ${process.version} · ${process.platform}/${process.arch}\n`);

// 1. Merkle verification and tamper localisation
console.log("### Merkle tree: full verification vs tamper localisation\n");
console.log("| Records (n) | Build both trees + compare (ms) | Node comparisons to locate 1 tampered record | Naive linear scan |");
console.log("|---:|---:|---:|---:|");
for (const n of [1_000, 10_000, 100_000]) {
  const trusted = Array.from({ length: n }, (_, i) => sha256Hex(`record-${i}`));
  const live = trusted.slice();
  live[Math.floor(n * 0.73)] = sha256Hex("tampered");
  let result = checkLedger(trusted, live);
  const t = ms(() => { result = checkLedger(trusted, live); });
  console.log(`| ${n.toLocaleString("en-US")} | ${fmt(t)} | ${result.visited} (2·⌈log2 n⌉ + 1 = ${2 * Math.ceil(Math.log2(n)) + 1}) | ${n.toLocaleString("en-US")} |`);
}

// 2. AVL vs unbalanced BST under sorted insertion
console.log("\n### AVL tree vs unbalanced BST, keys inserted in sorted order\n");
console.log("| Keys (n) | AVL height | Unbalanced BST height | log2(n) | AVL rotations |");
console.log("|---:|---:|---:|---:|---:|");
for (const n of [1_000, 10_000, 100_000]) {
  const tree = new AVLTree<number>();
  for (let i = 0; i < n; i++) tree.upsert(String(i).padStart(7, "0"), () => i);
  // sorted insertion into a plain BST always attaches to the right: height == n
  console.log(`| ${n.toLocaleString("en-US")} | ${tree.height} | ${n.toLocaleString("en-US")} | ${Math.log2(n).toFixed(1)} | ${tree.rotations.toLocaleString("en-US")} |`);
}

// 3. Knapsack
console.log("\n### Knapsack: DP vs Greedy vs Branch & Bound\n");
console.log("| Instance | Algorithm | CO2 saved | Work | Time (ms) |");
console.log("|---|---|---:|---:|---:|");
const web = [
  { cost: 180, co2: 72 }, { cost: 95, co2: 44 }, { cost: 65, co2: 26 },
  { cost: 140, co2: 61 }, { cost: 110, co2: 33 }, { cost: 75, co2: 21 },
];
let seed = 42;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const random = Array.from({ length: 24 }, () => ({ cost: 5 + Math.floor(rnd() * 60), co2: 10 + Math.floor(rnd() * 120) }));
for (const [name, items, budget] of [["6 projects, budget 220", web, 220], ["24 random items, budget 300", random, 300]] as const) {
  const dp = knapsackDP(items, budget), gr = knapsackGreedy(items, budget), bb = knapsackBranchAndBound(items, budget);
  console.log(`| ${name} | DP (optimal) | ${dp.benefit} | ${dp.explored.toLocaleString("en-US")} table cells | ${fmt(dp.ms)} |`);
  console.log(`| | Greedy | ${gr.benefit} (${((1 - gr.benefit / dp.benefit) * 100).toFixed(1)}% below optimal) | sort only | ${fmt(gr.ms)} |`);
  console.log(`| | Branch & Bound | ${bb.benefit} | ${bb.explored.toLocaleString("en-US")} of ${(2 ** (items.length + 1) - 1).toLocaleString("en-US")} tree nodes | ${fmt(bb.ms)} |`);
}
