#ifndef KNAPSACK_H
#define KNAPSACK_H

#define MAX_PROJECTS 64

typedef struct {
    char name[64];
    int cost;          /* in rupees (thousands, for smaller numbers) */
    double co2_saved;  /* kg CO2 saved if funded */
} Project;

/* 0/1 Knapsack via Dynamic Programming - guarantees the OPTIMAL
   combination of projects within budget. Prints selected projects
   and returns total CO2 saved. */
double knapsack_dp(Project projects[], int n, int budget);

/* Greedy approach: sort by CO2-per-rupee ratio, take until budget runs
   out. Fast, but NOT guaranteed optimal - used for comparison. */
double knapsack_greedy(Project projects[], int n, int budget);

/* Branch and Bound: explores the same search space as brute force but
   prunes branches whose best-possible outcome can't beat the current
   best found so far. Finds the optimal solution faster than checking
   every combination when there are many projects. */
double knapsack_branch_and_bound(Project projects[], int n, int budget);

#endif
