#ifndef HASH_H
#define HASH_H

#include "common.h"

#define HASH_TABLE_SIZE 1024

/* djb2 string hash - simple, fast, well known */
unsigned long hash_string(const char *str);

/* Combines a record's fields into one hash (its "fingerprint") */
unsigned long hash_record(const Record *r);

/* Hash of (user_id + action) only - used to detect a user claiming
   credit for the exact same action more than once */
unsigned long hash_duplicate_key(const char *user_id, const char *action);

/* --- Hash table used purely for O(1) duplicate detection --- */
typedef struct HashNode {
    unsigned long key;          /* the record's fingerprint hash  */
    struct HashNode *next;      /* chaining for collisions        */
} HashNode;

typedef struct {
    HashNode *buckets[HASH_TABLE_SIZE];
    int count;
} HashTable;

void hash_table_init(HashTable *table);
int  hash_table_contains(HashTable *table, unsigned long key); /* 1 if duplicate */
void hash_table_insert(HashTable *table, unsigned long key);
void hash_table_free(HashTable *table);

#endif
