#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "merkle.h"
#include "hash.h"

/* --- internal: build a tree bottom-up from an array of leaf hashes ---

   LEAF hash: each leaf's hash IS the record's fingerprint - i.e.
   hash_record() from hash.c, computed fresh from that record's
   current field values (user, action, co2, timestamp). It is NOT
   read from the record's stored record_hash field, which is what
   makes tampering detectable (see merkle_build() below).

   PARENT hash: a parent's hash = hash_string("leftHash|rightHash").
   Concatenating both children's hashes and hashing the result means
   the parent's hash depends on everything beneath it, all the way
   down to every leaf in its subtree.

   WHY ONE CHANGED RECORD CHANGES THE ROOT: because each parent hash
   folds in both children's hashes, a change to any single leaf
   changes that leaf's hash, which changes its parent's hash, which
   changes ITS parent's hash, and so on up to the root. So comparing
   just the root hash against a trusted root is enough to detect a
   tampered record ANYWHERE in the tree - no need to check every
   record individually. */
static MerkleNode *build_from_hashes(unsigned long *hashes, int count) {
    if (count == 0) return NULL;

    /* create leaf nodes */
    MerkleNode **level = malloc(sizeof(MerkleNode *) * count);
    for (int i = 0; i < count; i++) {
        level[i] = malloc(sizeof(MerkleNode));
        level[i]->hash = hashes[i];
        level[i]->left = level[i]->right = NULL;
        level[i]->lo = level[i]->hi = i;
    }

    int level_size = count;
    while (level_size > 1) {
        int next_size = (level_size + 1) / 2;
        MerkleNode **next_level = malloc(sizeof(MerkleNode *) * next_size);

        for (int i = 0; i < next_size; i++) {
            MerkleNode *l = level[2 * i];
            /* if odd number of nodes, pair the last one with itself */
            MerkleNode *r = (2 * i + 1 < level_size) ? level[2 * i + 1] : level[2 * i];

            char buffer[64];
            snprintf(buffer, sizeof(buffer), "%lu|%lu", l->hash, r->hash);

            MerkleNode *parent = malloc(sizeof(MerkleNode));
            parent->hash = hash_string(buffer);
            parent->left = l;
            parent->right = r;
            parent->lo = l->lo;
            parent->hi = r->hi;
            next_level[i] = parent;
        }
        free(level);
        level = next_level;
        level_size = next_size;
    }

    MerkleNode *root = level[0];
    free(level);
    return root;
}

void ledger_init(Ledger *ledger) {
    ledger->record_count = 0;
    ledger->root = NULL;
}

unsigned long merkle_build(Ledger *ledger) {
    if (ledger->record_count == 0) return 0;

    /* IMPORTANT: recompute each leaf hash fresh from the record's current
       field values (not the stored record_hash field). This is what makes
       tampering detectable - if a field like co2_saved is edited directly
       in memory/disk, the freshly computed hash will no longer match the
       old stored one, and the root hash will change. */
    unsigned long hashes[MAX_RECORDS];
    for (int i = 0; i < ledger->record_count; i++)
        hashes[i] = hash_record(&ledger->records[i]);

    merkle_free(ledger->root);
    ledger->root = build_from_hashes(hashes, ledger->record_count);
    return ledger->root->hash;
}

unsigned long ledger_commit(Ledger *ledger, Record r) {
    r.record_hash = hash_record(&r);
    ledger->records[ledger->record_count++] = r;
    return merkle_build(ledger);
}

int ledger_verify(Ledger *ledger, unsigned long trusted_root) {
    unsigned long current_root = merkle_build(ledger);
    return current_root == trusted_root;
}

/* Walks two trees (trusted snapshot vs recomputed) together.
   Only descends into branches whose hashes differ - O(log n) instead
   of O(n) record-by-record comparison. */
/* --- Tamper localization ---
   Walks the TRUSTED tree and the freshly-recomputed CURRENT tree in
   lockstep, one level at a time, starting from both roots.

   Key idea: a node's hash is a function of everything below it (see
   build_from_hashes()). So if trusted->hash == current->hash for a
   given node, EVERY record under that subtree is guaranteed unchanged
   - we can skip the whole subtree without looking at it.

   If the hashes differ, the tampered record must be somewhere under
   this node, so we recurse into both children (each covering half the
   remaining [lo, hi] record range) and repeat. This halves the search
   space at every level, so a single tampered leaf is found in
   O(log n) node visits instead of O(n) record-by-record comparison.

   [lo, hi] tracks which record-index range the current node covers;
   when lo == hi we've narrowed it down to exactly one record - that's
   the tampered one, so we record its index. */
static void locate_tamper(MerkleNode *trusted, MerkleNode *current,
                           int *out_indices, int *out_count) {
    if (trusted == NULL || current == NULL) return;

    if (trusted->hash == current->hash) return; /* this whole branch is fine */

    /* Each node stores the record range [lo, hi] it covers. Using the stored
       range (instead of splitting [lo, hi] at the midpoint) keeps indices
       correct when the ledger size is not a power of two, because the tree
       is built by pairing nodes bottom-up, so left and right subtrees are
       not always equal halves. */
    if (trusted->lo == trusted->hi) {
        out_indices[(*out_count)++] = trusted->lo;
        return;
    }

    locate_tamper(trusted->left, current->left, out_indices, out_count);
    /* an unpaired node is paired with itself: descend into it only once */
    if (trusted->right != trusted->left)
        locate_tamper(trusted->right, current->right, out_indices, out_count);
}

void ledger_find_tampered(Ledger *ledger, unsigned long trusted_root) {
    /* Rebuild "trusted" tree from the hashes ledger currently thinks are
       correct is not possible after tampering in-place, so in real use
       the trusted tree must be kept from the last verified snapshot.
       Here we demonstrate by rebuilding current tree and walking against
       the last known-good root's stored structure. */
    unsigned long current_root = merkle_build(ledger);
    if (current_root == trusted_root) {
        printf("  -> No tampering found.\n");
        return;
    }
    printf("  -> Root mismatch! Expected %lu, got %lu\n", trusted_root, current_root);
    printf("  -> (Use ledger_find_tampered_against snapshot for exact index)\n");
}

/* Proper version: compare against an explicit trusted snapshot tree */
int ledger_find_tampered_against(Ledger *ledger, MerkleNode *trusted_root_node, int *out_indices) {
    MerkleNode *current_root = build_from_hashes_from_ledger(ledger);
    int count = 0;
    locate_tamper(trusted_root_node, current_root, out_indices, &count);
    merkle_free(current_root);
    return count;
}

MerkleNode *build_from_hashes_from_ledger(Ledger *ledger) {
    unsigned long hashes[MAX_RECORDS];
    for (int i = 0; i < ledger->record_count; i++)
        hashes[i] = hash_record(&ledger->records[i]); /* recompute fresh, catches edits */
    return build_from_hashes(hashes, ledger->record_count);
}

void merkle_free(MerkleNode *node) {
    if (!node) return;
    if (node->left != node->right) { /* avoid double-free on self-paired leaf */
        merkle_free(node->left);
    }
    merkle_free(node->right);
    free(node);
}

/* ---------------- persistence ---------------- */

/* Simple binary format:
     [4 bytes]  magic "CLDG"
     [4 bytes]  int record_count
     [record_count * sizeof(Record)] raw records

   We deliberately do NOT persist the Merkle tree, AVL registry, or
   hash table - those are all derived state and get rebuilt from the
   records after loading. This keeps the on-disk format small and
   avoids ever having to serialize pointers. */

int ledger_save(const Ledger *ledger, const char *filepath) {
    if (!ledger || !filepath) return 0;

    FILE *fp = fopen(filepath, "wb");
    if (!fp) {
        fprintf(stderr, "  [ERROR] Could not open \"%s\" for writing.\n", filepath);
        return 0;
    }

    int ok = 1;
    if (fwrite(LEDGER_SAVE_MAGIC, 1, 4, fp) != 4) ok = 0;
    if (ok && fwrite(&ledger->record_count, sizeof(int), 1, fp) != 1) ok = 0;
    if (ok && ledger->record_count > 0 &&
        fwrite(ledger->records, sizeof(Record), (size_t)ledger->record_count, fp)
            != (size_t)ledger->record_count) ok = 0;

    if (fclose(fp) != 0) ok = 0;

    if (!ok) {
        fprintf(stderr, "  [ERROR] Failed writing ledger to \"%s\".\n", filepath);
        return 0;
    }
    return 1;
}

int ledger_load(Ledger *ledger, const char *filepath) {
    if (!ledger || !filepath) return 0;

    FILE *fp = fopen(filepath, "rb");
    if (!fp) {
        /* Not an error worth alarming the user over - just means no
           save file exists yet (e.g. first run). */
        return 0;
    }

    char magic[4];
    int count = 0;
    int ok = 1;

    if (fread(magic, 1, 4, fp) != 4 || memcmp(magic, LEDGER_SAVE_MAGIC, 4) != 0) {
        fprintf(stderr, "  [ERROR] \"%s\" is not a valid ledger save file.\n", filepath);
        ok = 0;
    }

    if (ok && fread(&count, sizeof(int), 1, fp) != 1) {
        fprintf(stderr, "  [ERROR] Corrupt ledger save file (missing count).\n");
        ok = 0;
    }

    if (ok && (count < 0 || count > MAX_RECORDS)) {
        fprintf(stderr, "  [ERROR] Corrupt ledger save file (invalid record count %d).\n", count);
        ok = 0;
    }

    if (ok && count > 0 &&
        fread(ledger->records, sizeof(Record), (size_t)count, fp) != (size_t)count) {
        fprintf(stderr, "  [ERROR] Corrupt ledger save file (truncated records).\n");
        ok = 0;
    }

    fclose(fp);

    if (!ok) return 0;

    ledger->record_count = count;
    ledger->root = NULL; /* caller rebuilds via refresh_trusted_snapshot()/merkle_build() */
    return 1;
}
