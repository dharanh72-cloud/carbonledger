#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "hash.h"

/* Classic djb2 hash - good distribution, very simple */
unsigned long hash_string(const char *str) {
    unsigned long hash = 5381;
    int c;
    while ((c = *str++))
        hash = ((hash << 5) + hash) + c;   /* hash * 33 + c */
    return hash;
}

/* A record's fingerprint = hash of (user + action + co2 + timestamp).
   Used as the Merkle tree leaf - includes timestamp so every ledger
   entry is unique, even if the same action is legitimately logged
   again later (e.g. tree planted this year AND next year). */
unsigned long hash_record(const Record *r) {
    char buffer[256];
    snprintf(buffer, sizeof(buffer), "%s|%s|%.4f|%ld",
             r->user_id, r->action, r->co2_saved, r->timestamp);
    return hash_string(buffer);
}

/* Duplicate-claim key: user + action only, NO timestamp. This is what
   actually stops someone claiming credit for the same action twice -
   e.g. "solar_panel_installed" by CS_Dept can only ever be logged once. */
unsigned long hash_duplicate_key(const char *user_id, const char *action) {
    char buffer[256];
    snprintf(buffer, sizeof(buffer), "%s|%s", user_id, action);
    return hash_string(buffer);
}

void hash_table_init(HashTable *table) {
    for (int i = 0; i < HASH_TABLE_SIZE; i++)
        table->buckets[i] = NULL;
    table->count = 0;
}

int hash_table_contains(HashTable *table, unsigned long key) {
    int idx = key % HASH_TABLE_SIZE;
    HashNode *node = table->buckets[idx];
    while (node) {
        if (node->key == key) return 1;
        node = node->next;
    }
    return 0;
}

void hash_table_insert(HashTable *table, unsigned long key) {
    int idx = key % HASH_TABLE_SIZE;
    HashNode *node = malloc(sizeof(HashNode));
    node->key = key;
    node->next = table->buckets[idx];   /* insert at head (chaining) */
    table->buckets[idx] = node;
    table->count++;
}

void hash_table_free(HashTable *table) {
    for (int i = 0; i < HASH_TABLE_SIZE; i++) {
        HashNode *node = table->buckets[i];
        while (node) {
            HashNode *tmp = node;
            node = node->next;
            free(tmp);
        }
    }
}
