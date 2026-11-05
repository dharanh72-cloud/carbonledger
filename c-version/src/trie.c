#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include "trie.h"

TrieNode *trie_create_node(void) {
    TrieNode *node = malloc(sizeof(TrieNode));
    node->is_end = 0;
    node->co2_factor = 0.0;
    for (int i = 0; i < ALPHABET_SIZE; i++)
        node->children[i] = NULL;
    return node;
}

/* maps 'a'-'z' -> 0-25, '_' -> 26 */
static int char_index(char c) {
    if (c == '_') return 26;
    return tolower(c) - 'a';
}

void trie_insert(TrieNode *root, const char *action, double co2_factor) {
    TrieNode *cur = root;
    for (int i = 0; action[i] != '\0'; i++) {
        int idx = char_index(action[i]);
        if (idx < 0 || idx >= ALPHABET_SIZE) continue; /* skip unexpected chars */
        if (cur->children[idx] == NULL)
            cur->children[idx] = trie_create_node();
        cur = cur->children[idx];
    }
    cur->is_end = 1;
    cur->co2_factor = co2_factor;
}

int trie_lookup(TrieNode *root, const char *action, double *co2_factor) {
    TrieNode *cur = root;
    for (int i = 0; action[i] != '\0'; i++) {
        int idx = char_index(action[i]);
        if (idx < 0 || idx >= ALPHABET_SIZE) return 0;
        if (cur->children[idx] == NULL) return 0;
        cur = cur->children[idx];
    }
    if (cur->is_end) {
        *co2_factor = cur->co2_factor;
        return 1;
    }
    return 0;
}

/* DFS from a node, rebuilding the full word as we go down */
static int dfs_print(TrieNode *node, char *buffer, int depth) {
    int matches = 0;
    if (node->is_end) {
        buffer[depth] = '\0';
        printf("    -> %-25s (%.1f kg)\n", buffer, node->co2_factor);
        matches++;
    }
    for (int i = 0; i < ALPHABET_SIZE; i++) {
        if (node->children[i]) {
            buffer[depth] = (i == 26) ? '_' : ('a' + i);
            matches += dfs_print(node->children[i], buffer, depth + 1);
        }
    }
    return matches;
}

void trie_autocomplete(TrieNode *root, const char *prefix) {
    TrieNode *cur = root;
    char buffer[128];
    int len = 0;

    for (; prefix[len] != '\0'; len++) {
        int idx = char_index(prefix[len]);
        if (idx < 0 || idx >= ALPHABET_SIZE || cur->children[idx] == NULL) {
            printf("  Suggestions for \"%s\":\n", prefix);
            printf("    No matches.\n");
            return;
        }
        buffer[len] = prefix[len];
        cur = cur->children[idx];
    }

    printf("  Suggestions for \"%s\":\n", prefix);
    int matches = dfs_print(cur, buffer, len);
    if (matches == 0)
        printf("    No matches.\n");
}

void trie_free(TrieNode *root) {
    if (!root) return;
    for (int i = 0; i < ALPHABET_SIZE; i++)
        trie_free(root->children[i]);
    free(root);
}
