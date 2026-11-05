#ifndef MERKLE_H
#define MERKLE_H

#include "common.h"

#define MAX_RECORDS 1024

typedef struct MerkleNode {
    unsigned long hash;
    struct MerkleNode *left;
    struct MerkleNode *right;
    int lo;   /* first record index covered by this subtree */
    int hi;   /* last record index covered by this subtree  */
} MerkleNode;

typedef struct {
    Record records[MAX_RECORDS];   /* the actual ledger, in commit order */
    int record_count;
    MerkleNode *root;              /* current root of the Merkle tree    */
} Ledger;

void ledger_init(Ledger *ledger);

/* Adds an already-hashed record as the next leaf and rebuilds the tree.
   Returns the new root hash. */
unsigned long ledger_commit(Ledger *ledger, Record r);

/* Rebuilds the Merkle tree from scratch over ledger->records[0..count-1]
   and returns the root hash. Used both after a commit and during verify. */
unsigned long merkle_build(Ledger *ledger);

/* Recomputes the tree fresh from stored records and compares to the
   currently trusted root. Returns 1 if the ledger is intact, 0 if tampered. */
int ledger_verify(Ledger *ledger, unsigned long trusted_root);

/* If verify fails, this finds and prints the index of the tampered record
   by walking the tree in O(log n) rather than rechecking every record. */
void ledger_find_tampered(Ledger *ledger, unsigned long trusted_root);

/* Compares live ledger data against a saved trusted snapshot tree and
   finds the exact record index(es) that were tampered with, in O(log n)
   per mismatched branch rather than O(n) full comparison.
   Writes tampered indices into out_indices (caller-allocated, must hold
   at least ledger->record_count ints) and returns how many were found. */
int ledger_find_tampered_against(Ledger *ledger, MerkleNode *trusted_root_node, int *out_indices);
MerkleNode *build_from_hashes_from_ledger(Ledger *ledger);

void merkle_free(MerkleNode *node);

/* --- Persistence ---
   Saves/loads only the raw records (source of truth). The Merkle tree,
   AVL registry, and duplicate hash table are all cheap to rebuild from
   records on load, so we never serialize pointers/tree structure. */
#define LEDGER_SAVE_MAGIC "CLDG"

/* Returns 1 on success, 0 on failure (prints an error message). */
int ledger_save(const Ledger *ledger, const char *filepath);

/* Returns 1 on success, 0 on failure (prints an error message).
   On success, ledger is fully initialized and ready to use;
   caller is still responsible for rebuilding registry/hash table/
   Merkle snapshot from the loaded records. */
int ledger_load(Ledger *ledger, const char *filepath);

#endif
