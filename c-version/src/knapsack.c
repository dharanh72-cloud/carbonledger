#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "knapsack.h"

/* ---------------- 0/1 Knapsack via Dynamic Programming ---------------- */
/* dp[i][w] = max CO2 saved using the first i projects within budget w.
   This is the OPTIMAL answer - no combination can beat it. */
double knapsack_dp(Project projects[], int n, int budget) {
    double **dp = malloc((n + 1) * sizeof(double *));
    for (int i = 0; i <= n; i++)
        dp[i] = calloc(budget + 1, sizeof(double));

    for (int i = 1; i <= n; i++) {
        int cost = projects[i - 1].cost;
        double value = projects[i - 1].co2_saved;
        for (int w = 0; w <= budget; w++) {
            if (cost <= w)
                dp[i][w] = (dp[i - 1][w - cost] + value > dp[i - 1][w])
                               ? dp[i - 1][w - cost] + value
                               : dp[i - 1][w];
            else
                dp[i][w] = dp[i - 1][w];
        }
    }

    double best = dp[n][budget];

    /* backtrack through the table to find which projects were chosen */
    printf("  [DP] Selected projects (optimal, total CO2 = %.1f kg):\n", best);
    int w = budget;
    for (int i = n; i > 0; i--) {
        if (dp[i][w] != dp[i - 1][w]) {
            printf("    - %s (cost %d, saves %.1f kg)\n",
                   projects[i - 1].name, projects[i - 1].cost, projects[i - 1].co2_saved);
            w -= projects[i - 1].cost;
        }
    }

    for (int i = 0; i <= n; i++) free(dp[i]);
    free(dp);
    return best;
}

/* ---------------- Greedy: sort by CO2-per-rupee, fill budget ---------------- */
double knapsack_greedy(Project projects[], int n, int budget) {
    /* copy so we don't disturb the original order used by DP/B&B */
    Project *sorted = malloc(n * sizeof(Project));
    memcpy(sorted, projects, n * sizeof(Project));

    /* simple insertion sort by ratio descending - n is small (<= MAX_PROJECTS) */
    for (int i = 1; i < n; i++) {
        Project key = sorted[i];
        double key_ratio = key.co2_saved / key.cost;
        int j = i - 1;
        while (j >= 0 && (sorted[j].co2_saved / sorted[j].cost) < key_ratio) {
            sorted[j + 1] = sorted[j];
            j--;
        }
        sorted[j + 1] = key;
    }

    int remaining = budget;
    double total = 0.0;
    printf("  [GREEDY] Selected projects (best ratio first, total CO2 = ");
    for (int i = 0; i < n; i++) {
        if (sorted[i].cost <= remaining) {
            remaining -= sorted[i].cost;
            total += sorted[i].co2_saved;
        }
    }
    printf("%.1f kg):\n", total);

    remaining = budget;
    for (int i = 0; i < n; i++) {
        if (sorted[i].cost <= remaining) {
            remaining -= sorted[i].cost;
            printf("    - %s (cost %d, saves %.1f kg)\n",
                   sorted[i].name, sorted[i].cost, sorted[i].co2_saved);
        }
    }

    free(sorted);
    return total;
}

/* ---------------- Branch and Bound ---------------- */
typedef struct {
    int level;          /* index of next project being considered   */
    int cost_so_far;
    double value_so_far;
    double bound;        /* best possible value achievable from here  */
} BBNode;

/* Upper bound estimate: take remaining items greedily by ratio,
   allowing a fractional slice of the last one - this is always an
   OVER-estimate of the true best possible, which is what makes
   pruning against it safe. */
static double calculate_bound(BBNode node, int n, int budget, Project sorted[]) {
    if (node.cost_so_far >= budget) return 0;

    double bound = node.value_so_far;
    int total_cost = node.cost_so_far;

    int i = node.level;
    while (i < n && total_cost + sorted[i].cost <= budget) {
        total_cost += sorted[i].cost;
        bound += sorted[i].co2_saved;
        i++;
    }
    if (i < n) {
        /* take a fractional slice of the next item */
        bound += (budget - total_cost) * (sorted[i].co2_saved / (double)sorted[i].cost);
    }
    return bound;
}

double knapsack_branch_and_bound(Project projects[], int n, int budget) {
    Project *sorted = malloc(n * sizeof(Project));
    memcpy(sorted, projects, n * sizeof(Project));

    /* sort by ratio descending - needed for the bound function to be valid */
    for (int i = 1; i < n; i++) {
        Project key = sorted[i];
        double key_ratio = key.co2_saved / key.cost;
        int j = i - 1;
        while (j >= 0 && (sorted[j].co2_saved / sorted[j].cost) < key_ratio) {
            sorted[j + 1] = sorted[j];
            j--;
        }
        sorted[j + 1] = key;
    }

    /* simple stack-based DFS with pruning (explicit stack instead of
       recursion so it's easy to see the search-space being cut down) */
    BBNode *stack = malloc(sizeof(BBNode) * (n + 1) * 4);
    int top = 0;
    int nodes_explored = 0, nodes_pruned = 0;

    double best_value = 0;

    BBNode root = {0, 0, 0.0, 0.0};
    root.bound = calculate_bound(root, n, budget, sorted);
    stack[top++] = root;

    while (top > 0) {
        BBNode cur = stack[--top];
        nodes_explored++;

        if (cur.level == n || cur.bound <= best_value) {
            if (cur.bound <= best_value && cur.level != n) nodes_pruned++;
            continue; /* leaf, or this branch can't beat what we already found */
        }

        /* branch 1: include projects[level] */
        BBNode with_item;
        with_item.level = cur.level + 1;
        with_item.cost_so_far = cur.cost_so_far + sorted[cur.level].cost;
        with_item.value_so_far = cur.value_so_far + sorted[cur.level].co2_saved;
        if (with_item.cost_so_far <= budget) {
            if (with_item.value_so_far > best_value) best_value = with_item.value_so_far;
            with_item.bound = calculate_bound(with_item, n, budget, sorted);
            if (with_item.bound > best_value) stack[top++] = with_item;
            else nodes_pruned++;
        }

        /* branch 2: exclude projects[level] */
        BBNode without_item;
        without_item.level = cur.level + 1;
        without_item.cost_so_far = cur.cost_so_far;
        without_item.value_so_far = cur.value_so_far;
        without_item.bound = calculate_bound(without_item, n, budget, sorted);
        if (without_item.bound > best_value) stack[top++] = without_item;
        else nodes_pruned++;
    }

    printf("  [BRANCH & BOUND] Best CO2 achievable = %.1f kg\n", best_value);
    printf("    (explored %d nodes, pruned %d branches out of the full search tree)\n",
           nodes_explored, nodes_pruned);

    free(stack);
    free(sorted);
    return best_value;
}
