#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "avl.h"

/* Total rotations performed since program start - a quick, honest way
   to show in the demo that the tree is actually rebalancing itself
   rather than just trusting the code. Reset only on avl_free() of the
   whole tree (i.e. on a ledger reset), not per-insert. */
static long total_rotations = 0;
static char last_rotation_case[4] = "";   /* "LL" / "RR" / "LR" / "RL" */

int avl_height(AVLNode *node) {
    return node ? node->height : 0;
}

static int max_int(int a, int b) { return a > b ? a : b; }

int avl_balance_factor(AVLNode *node) {
    return node ? avl_height(node->left) - avl_height(node->right) : 0;
}

long avl_rotation_count(void) {
    return total_rotations;
}

const char *avl_last_rotation(void) {
    return last_rotation_case[0] ? last_rotation_case : "none";
}

void avl_reset_rotation_stats(void) {
    total_rotations = 0;
    last_rotation_case[0] = '\0';
}

static AVLNode *make_node(const char *user_id, double co2) {
    AVLNode *n = malloc(sizeof(AVLNode));
    strncpy(n->user_id, user_id, MAX_STR - 1);
    n->user_id[MAX_STR - 1] = '\0'; /* strncpy doesn't guarantee this if
                                        user_id is >= MAX_STR chars */
    n->total_co2 = co2;
    n->height = 1;
    n->left = n->right = NULL;
    return n;
}

/* standard right rotation, used when left subtree is too heavy */
static AVLNode *rotate_right(AVLNode *y) {
    AVLNode *x = y->left;
    AVLNode *t2 = x->right;

    x->right = y;
    y->left = t2;

    y->height = max_int(avl_height(y->left), avl_height(y->right)) + 1;
    x->height = max_int(avl_height(x->left), avl_height(x->right)) + 1;

    return x; /* new subtree root */
}

/* standard left rotation, used when right subtree is too heavy */
static AVLNode *rotate_left(AVLNode *x) {
    AVLNode *y = x->right;
    AVLNode *t2 = y->left;

    y->left = x;
    x->right = t2;

    x->height = max_int(avl_height(x->left), avl_height(x->right)) + 1;
    y->height = max_int(avl_height(y->left), avl_height(y->right)) + 1;

    return y; /* new subtree root */
}

AVLNode *avl_insert_or_update(AVLNode *node, const char *user_id, double co2_amount) {
    if (node == NULL)
        return make_node(user_id, co2_amount);

    int cmp = strcmp(user_id, node->user_id);
    if (cmp == 0) {
        node->total_co2 += co2_amount;   /* existing user: add to their total */
        return node;
    } else if (cmp < 0) {
        node->left = avl_insert_or_update(node->left, user_id, co2_amount);
    } else {
        node->right = avl_insert_or_update(node->right, user_id, co2_amount);
    }

    node->height = 1 + max_int(avl_height(node->left), avl_height(node->right));
    int bf = avl_balance_factor(node);

    /* Left-Left case: left subtree too heavy, new key went further left.
       A single right rotation on `node` restores balance. */
    if (bf > 1 && strcmp(user_id, node->left->user_id) < 0) {
        total_rotations++;
        strcpy(last_rotation_case, "LL");
        return rotate_right(node);
    }

    /* Right-Right case: right subtree too heavy, new key went further
       right. A single left rotation on `node` restores balance. */
    if (bf < -1 && strcmp(user_id, node->right->user_id) > 0) {
        total_rotations++;
        strcpy(last_rotation_case, "RR");
        return rotate_left(node);
    }

    /* Left-Right case: left subtree too heavy, but new key went right
       of node->left. Straightening it into the LL shape needs a left
       rotation on node->left first, then the usual right rotation.
       Counts as ONE rotation event for reporting purposes, even though
       two rotate_*() calls happen underneath. */
    if (bf > 1 && strcmp(user_id, node->left->user_id) > 0) {
        node->left = rotate_left(node->left);
        total_rotations++;
        strcpy(last_rotation_case, "LR");
        return rotate_right(node);
    }

    /* Right-Left case: right subtree too heavy, but new key went left
       of node->right. Mirror of LR - right rotation on node->right
       first, then the usual left rotation. */
    if (bf < -1 && strcmp(user_id, node->right->user_id) < 0) {
        node->right = rotate_right(node->right);
        total_rotations++;
        strcpy(last_rotation_case, "RL");
        return rotate_left(node);
    }

    return node; /* already balanced */
}

AVLNode *avl_search(AVLNode *root, const char *user_id) {
    if (root == NULL) return NULL;
    int cmp = strcmp(user_id, root->user_id);
    if (cmp == 0) return root;
    return cmp < 0 ? avl_search(root->left, user_id) : avl_search(root->right, user_id);
}

void avl_inorder(AVLNode *root) {
    if (!root) return;
    avl_inorder(root->left);
    printf("  %-15s total CO2 saved: %.1f kg\n", root->user_id, root->total_co2);
    avl_inorder(root->right);
}

int avl_collect(AVLNode *root, AVLNode **out, int idx) {
    if (!root) return idx;
    idx = avl_collect(root->left, out, idx);
    out[idx++] = root;
    idx = avl_collect(root->right, out, idx);
    return idx;
}

void avl_free(AVLNode *root) {
    if (!root) return;
    avl_free(root->left);
    avl_free(root->right);
    free(root);
}