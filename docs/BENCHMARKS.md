# Benchmarks

Measured with `pnpm bench` (in `web/`) against the TypeScript implementations in `web/client/src/lib/dsa/`.
Absolute times depend on the machine, so treat the **work counts** (node comparisons, tree height, table cells) as
the result and the milliseconds as indicative. Environment for the numbers below: see the first line of the output.

Reproduce: `cd web && pnpm install && pnpm bench`

```text
Node v22.22.2 · linux/x64

### Merkle tree: full verification vs tamper localisation

| Records (n) | Build both trees + compare (ms) | Node comparisons to locate 1 tampered record | Naive linear scan |
|---:|---:|---:|---:|
| 1,000 | 20.6 | 21 (2·⌈log2 n⌉ + 1 = 21) | 1,000 |
| 10,000 | 215 | 29 (2·⌈log2 n⌉ + 1 = 29) | 10,000 |
| 100,000 | 2060 | 35 (2·⌈log2 n⌉ + 1 = 35) | 100,000 |

### AVL tree vs unbalanced BST, keys inserted in sorted order

| Keys (n) | AVL height | Unbalanced BST height | log2(n) | AVL rotations |
|---:|---:|---:|---:|---:|
| 1,000 | 10 | 1,000 | 10.0 | 990 |
| 10,000 | 14 | 10,000 | 13.3 | 9,986 |
| 100,000 | 17 | 100,000 | 16.6 | 99,983 |

### Knapsack: DP vs Greedy vs Branch & Bound

| Instance | Algorithm | CO2 saved | Work | Time (ms) |
|---|---|---:|---:|---:|
| 6 projects, budget 220 | DP (optimal) | 87 | 1,326 table cells | 0.36 |
| | Greedy | 70 (19.5% below optimal) | sort only | 0.06 |
| | Branch & Bound | 87 | 22 of 127 tree nodes | 0.28 |
| 24 random items, budget 300 | DP (optimal) | 1029 | 7,224 table cells | 0.97 |
| | Greedy | 1029 (0.0% below optimal) | sort only | 0.04 |
| | Branch & Bound | 1029 | 57 of 33,554,431 tree nodes | 0.09 |
```

## How to read these

- **Merkle:** Verifying a whole ledger is O(n) (every leaf must be hashed once). The payoff is *after* a mismatch is
  detected: the trusted and current trees are walked together and every subtree whose hash still matches is skipped, so
  finding one tampered record among 100,000 takes 35 node comparisons instead of scanning 100,000 records.
- **AVL vs plain BST:** Sorted keys are the worst case for an unbalanced BST (it degenerates into a linked list, height n).
  The AVL tree stays within about 1.44·log2(n) of optimal. The BST column is analytic (height = n for sorted insertion),
  not a timing.
- **Knapsack:** DP is exact in O(n·W). Greedy is fast but can miss the optimum (19.5% below on the 6-project instance).
  Branch & Bound reaches the DP optimum while visiting a tiny fraction of the 2^(n+1)-1 possible tree nodes. On the
  random 24-item instance Greedy happened to be optimal, so the gap depends on the instance.
- The SHA-256 here is a pure-TypeScript implementation (so hashing is synchronous and unit-testable); it is slower than
  the browser's native Web Crypto, which matters only for the 100,000-record row.
