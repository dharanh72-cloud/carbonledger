#ifndef TRIE_H
#define TRIE_H

#define ALPHABET_SIZE 27   /* a-z plus underscore */

typedef struct TrieNode {
    struct TrieNode *children[ALPHABET_SIZE];
    int is_end;
    double co2_factor;      /* only meaningful when is_end == 1 */
} TrieNode;

TrieNode *trie_create_node(void);

/* Registers a known action (e.g. "tree_planted") with its CO2 impact */
void trie_insert(TrieNode *root, const char *action, double co2_factor);

/* Exact lookup: returns 1 and sets *co2_factor if found, else 0 */
int trie_lookup(TrieNode *root, const char *action, double *co2_factor);

/* Autocomplete: prints all known actions starting with the given prefix */
void trie_autocomplete(TrieNode *root, const char *prefix);

void trie_free(TrieNode *root);

#endif
