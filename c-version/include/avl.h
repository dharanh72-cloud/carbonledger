#ifndef AVL_H
#define AVL_H

#include "common.h"

typedef struct AVLNode {
    char user_id[MAX_STR];
    double total_co2;          /* running total CO2 saved by this user */
    int height;
    struct AVLNode *left, *right;
} AVLNode;

/* Insert a new user, or add co2_amount to an existing user's total.
   Returns the (possibly new) root of the subtree. */
AVLNode *avl_insert_or_update(AVLNode *node, const char *user_id, double co2_amount);

/* Find a user's node (NULL if not registered) */
AVLNode *avl_search(AVLNode *root, const char *user_id);

/* In-order traversal - prints users sorted alphabetically by user_id */
void avl_inorder(AVLNode *root);

/* Collects all nodes into an array (used to feed the heap for ranking) */
int avl_collect(AVLNode *root, AVLNode **out, int idx);

int avl_height(AVLNode *node);

/* Difference in height between left and right subtrees.
   |bf| > 1 would mean the tree is unbalanced (AVL invariant keeps
   this in [-1, 1] after every insert). Exposed mainly for demo/viva
   output so rotations can be shown to actually keep things balanced. */
int avl_balance_factor(AVLNode *node);

/* Total number of rotation EVENTS performed since the last reset
   (LL/RR count as 1, LR/RL count as 1 even though they internally
   call rotate_*() twice). Lets the demo show "the tree really is
   self-balancing" with a running counter instead of just claiming it. */
long avl_rotation_count(void);

/* "LL" / "RR" / "LR" / "RL" for the most recent rotation, or "none"
   if no rotation has happened yet (or since the last reset). */
const char *avl_last_rotation(void);

/* Zeroes the rotation counter/last-rotation label. Call this whenever
   the tree itself is reset (see avl_free() + a fresh registry). */
void avl_reset_rotation_stats(void);

/* Frees every node in the subtree (post-order, so children are freed
   before their parent). Safe to call on NULL. */
void avl_free(AVLNode *root);

#endif
