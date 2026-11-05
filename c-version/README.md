# CarbonLedger
### A Tamper-Proof Carbon Credit Fraud-Detection System (C)

## Objective

Build a terminal-based system that lets users/departments log eco-friendly
actions (tree planting, solar installs, etc.) and earn "green points,"
while guaranteeing the ledger can't be silently altered afterward — and
optimally allocate a green-fund budget across candidate projects. The
project exists to demonstrate correct, real implementations of the core
data structures and algorithms in the syllabus, applied to one coherent
problem rather than six disconnected toy demos.

## Tech Stack

- **Language:** C (C99), compiled with `gcc`
- **Standard library only** — no external dependencies, so it builds
  anywhere a C compiler is available
- **Persistence:** raw binary file I/O (`fwrite`/`fread`), no database

## Data Structures Used

| Structure | Used for | Why this structure |
|---|---|---|
| **Merkle Tree** | Tamper-evident ledger (`merkle.c`) | Any single-record edit changes that leaf's hash, which propagates to the root — so tampering is detectable from one root-hash comparison, and the exact tampered record can be located in O(log n) instead of re-checking every record |
| **AVL Tree** | User/department registry (`avl.c`) | Keeps users sorted by ID with guaranteed O(log n) insert/search/update even in the worst case (unlike a plain BST, which can degrade to a linked list on sorted input) |
| **Trie** | Known-action catalog + autocomplete (`trie.c`) | O(length of word) lookup/insert regardless of how many actions are registered, plus natural prefix-based autocomplete that a hash table can't do |
| **Hash Table (chaining)** | Duplicate-claim detection (`hash.c`) | O(1) average-case check for "has this user already claimed this exact action" on every log attempt |
| **Max-Heap** | Leaderboard / top-K contributors (`heap.c`) | Extracting the top K of N users is O(K log N) with a heap, versus O(N log N) for sorting everyone when K is small |
| **Dynamic Programming / Greedy / Branch & Bound** | Green-fund budget allocation (`knapsack.c`) | Classic 0/1 knapsack over candidate projects; the three approaches are implemented side by side specifically to *compare* optimal-but-slower (DP), fast-but-suboptimal (Greedy), and optimal-but-pruned (Branch & Bound) |

## How the Merkle Tree Works

This is the core anti-fraud mechanism, so it's worth spelling out precisely
rather than just naming the structure.

**1. Leaf hash.** Every ledger record is hashed fresh from its *current*
field values — `hash_string("user|action|co2|timestamp")` (djb2 hash, see
`hash_record()` in `hash.c`). This is recomputed from the live record every
time, never read from a stored "trusted" field, which is exactly what makes
tampering visible.

**2. Parent hash.** Each internal node's hash is
`hash_string("leftChildHash|rightChildHash")` — the two children's hashes
concatenated and hashed together (see `build_from_hashes()` in `merkle.c`).

**3. Why changing one record changes the root.** Because every parent hash
folds in both of its children's hashes, a change to any single leaf changes
that leaf's hash → changes its parent's hash → changes *that* parent's hash
→ ... all the way up to the root. So comparing just the root hash against a
previously trusted root is enough to catch a tampered record anywhere in
the ledger, without checking every record.

```
                          ROOT = H(H(AB) | H(CD))
                         /                        \
              H(AB)=H(A|B)                  H(CD)=H(C|D)
               /        \                    /        \
         A=hash(rec0) B=hash(rec1)    C=hash(rec2) D=hash(rec3)

  If rec1 is edited: B changes -> H(AB) changes -> ROOT changes.
  H(CD) and its leaves (C, D) are untouched.
```

**4. Locating the tampered record in O(log n).** `ledger_find_tampered_against()`
walks the *trusted* tree and the freshly rebuilt *current* tree together,
starting at both roots. At each pair of nodes: if their hashes match, the
entire subtree underneath is provably unchanged, so that whole branch is
skipped. If the hashes differ, the problem is somewhere in that subtree, so
we recurse into both children (each covering half the record-index range)
and repeat. This halves the search space at every level — from the diagram
above, a mismatch at the root sends us into `H(AB)` (matches, skip) and
`H(CD)` (mismatch, recurse) — until the range narrows to exactly one record
index, which is the tampered one. That's O(log n) node visits instead of
O(n) record-by-record comparison. See the extended comment above
`locate_tamper()` in `merkle.c` for the code-level walkthrough.

## Complexity Analysis

| Operation | Data Structure | Time Complexity |
|---|---|---|
| Insert user | AVL Tree | O(log n) |
| Duplicate check | Hash Table | O(1) average |
| Action lookup | Trie | O(L) — L = length of action name |
| Leaderboard (Top-K) | Binary Heap | O(n) build + O(K log n) extract |
| Ledger verify (rebuild + compare) | Merkle Tree | O(n) |
| Locate tampered record | Merkle Tree | O(log n) |
| Budget allocation | DP Knapsack | O(n · W) — W = budget |

## Build & Run

```bash
gcc -Wall -Wextra -Iinclude src/*.c -o carbonledger
./carbonledger
```

The ledger auto-loads from `carbonledger.dat` on startup (if present) and
auto-saves to it on exit, so data survives between runs. Use menu option
`11` to save manually at any point, or `12` to wipe everything and start
fresh.

## Demo Steps (viva walkthrough)

1. **Log actions** — Choice `1` → log a couple of actions for different
   users (e.g. `alice` / `tree_planted`, `bob` / `solar_panel_installed`).
   Watch the AVL balance-factor line printed after each commit, and the
   `Tree rebalanced with a ... rotation` line whenever an insert actually
   triggers one (try adding users in alphabetical order to force it).
2. **Duplicate detection** — Choice `1` again with the *same* user +
   action → watch it get REJECTED (hash table lookup).
3. **Autocomplete** — Choice `3`, type a partial action name like `sol`
   → see matching known actions and their CO2 factors (Trie).
4. **Leaderboard** — Choice `2` → top-K contributors via the max-heap.
5. **View records** — Choice `8` → full ledger table (index, user,
   action, CO2, timestamp, hash).
6. **Verify integrity** — Choice `4` → should report "OK - ledger
   intact" (Merkle root matches).
7. **Simulate an attack** — Choice `5` → pick a record index, give it a
   fake inflated CO2 value (simulates an attacker editing a record
   directly, without updating its hash).
8. **Catch the attack** — Choice `4` again → reports "TAMPERED!", the
   exact record index, and the trusted vs. current CO2 values.
9. **Budget allocation** — Choice `6` → enter a budget (e.g. `150`) and
   compare DP vs Greedy vs Branch & Bound results side by side.
10. **Persistence** — Exit with `0` (auto-saves), relaunch the program,
    and choice `8`/`10` to show the ledger reloaded intact.

## File structure

```
carbonledger/
├── include/
│   ├── common.h     - shared Record struct
│   ├── hash.h        - djb2 hashing + hash table (duplicate detection)
│   ├── merkle.h       - Merkle tree (tamper-proof ledger) + save/load
│   ├── avl.h           - AVL tree (user/department registry)
│   ├── trie.h           - Trie (action name lookup/autocomplete)
│   ├── heap.h             - Max-heap (leaderboard/top-K ranking)
│   └── knapsack.h          - DP / Greedy / Branch & Bound (budget allocation)
├── src/
│   └── (matching .c files, plus main.c which ties it all together)
```

## Syllabus → Feature mapping

| Unit | Topic | Where it's used |
|---|---|---|
| 1 | BST concepts | Foundation for the AVL registry (Unit 2) |
| 2 | AVL Tree | `registry` — self-balancing user/department index, insert/update with rotations (LL/RR/LR/RL, see comments in `avl.c`) |
| 2 | Binary Heap | `heap.c` — leaderboard, top-K contributors without a full sort |
| 3 | Trie | `trie.c` — known-action lookup + autocomplete |
| 3 | Hashing & collision handling | `hash.c` — djb2 hash, chaining, duplicate-claim detection |
| 3 | Merkle Tree | `merkle.c` — tamper-evident ledger, O(log n) tamper localization |
| 4 | Dynamic Programming | `knapsack_dp()` — optimal green-fund project selection |
| 4 | Greedy Technique | `knapsack_greedy()` — compared against DP to show suboptimality |
| 4 | Branch and Bound | `knapsack_branch_and_bound()` — pruned search reaching the same optimum faster |
| 4 | Empirical/Asymptotic analysis | Compare node-count/pruned-branch output printed by Branch & Bound; can be extended with `time.h` benchmarks (see "Next steps") |

## Sample Output

Run the demo steps above and take a screenshot of your terminal after
step 8 (the "TAMPERED!" detection) and step 9 (the DP/Greedy/B&B
comparison table) — those two screens show the most syllabus-relevant
behavior and are the best evidence to paste into your report.

## Suggested next steps for your report

- Add `time.h` timing around BST vs AVL insert, and DP vs Greedy vs Branch & Bound,
  to produce the empirical growth-rate graphs Unit 4 expects.
- Extend duplicate-claim checking with a real timestamp/date window
  (e.g. "once per year") instead of "once ever," if that fits your problem framing better.

## Limitations

- Fixed-capacity storage: `MAX_RECORDS` (1024) and `MAX_HEAP_SIZE` (512)
  are compile-time array bounds, not dynamic — a very large department
  would need these raised and recompiled.
- Single-user, single-process: the save file (`carbonledger.dat`) has no
  locking, so two instances running against the same file concurrently
  could overwrite each other's data.
- The save file is plain binary, not encrypted or signed — someone with
  filesystem access could still edit it directly between runs (the
  in-app tamper detection only protects the ledger *while the program is
  running and has a trusted root in memory*).
- djb2 is a fast, simple hash chosen for teaching clarity, not a
  cryptographic hash — collisions are astronomically unlikely for this
  dataset size but djb2 offers no formal collision-resistance guarantee
  the way SHA-256 would.
- Terminal-only interface; no concurrent multi-user access.

## Future Scope

- Digital signatures (e.g. per-record or per-commit) for stronger,
  non-repudiable authenticity beyond hash-based tamper detection.
- Persistent storage with an encrypted ledger file, so tampering
  detection extends to data at rest, not just in-memory state.
- A web-based dashboard for the leaderboard and verification status.
- Multi-level organizational hierarchy (e.g. department → sub-team →
  individual) using a tree structure layered on top of the AVL registry.

## References

- Merkle, R. C. (1988). *A Digital Signature Based on a Conventional
  Encryption Function.* — original Merkle tree construction.
- Adelson-Velsky, G. M. & Landis, E. M. (1962). *An algorithm for the
  organization of information.* — AVL tree balancing.
- Fredkin, E. (1960). *Trie Memory.* — trie data structure.
