export interface Item { cost: number; co2: number }

export interface Solution<T> {
  selected: T[];
  cost: number;
  benefit: number;
  /** DP: table cells filled. Greedy: 0. Branch & bound: search-tree nodes visited. */
  explored: number;
  /** Branch & bound only: branches cut by the bound or the budget. */
  pruned: number;
  /** Wall-clock time of the solve, in milliseconds. */
  ms: number;
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const sum = (items: Item[]) => items.reduce((s, it) => ({ cost: s.cost + it.cost, benefit: s.benefit + it.co2 }), { cost: 0, benefit: 0 });

function finish<T extends Item>(selected: T[], explored: number, pruned: number, t0: number): Solution<T> {
  const { cost, benefit } = sum(selected);
  return { selected, cost, benefit, explored, pruned, ms: now() - t0 };
}

/** 0/1 knapsack by dynamic programming. Optimal. O(n * budget) time and space; costs must be integers. */
export function knapsackDP<T extends Item>(items: T[], budget: number): Solution<T> {
  const t0 = now();
  const n = items.length;
  const W = Math.max(0, Math.floor(budget));
  const dp = Array.from({ length: n + 1 }, () => new Float64Array(W + 1));
  for (let i = 1; i <= n; i++) {
    const { cost, co2 } = items[i - 1];
    for (let w = 0; w <= W; w++) {
      dp[i][w] = dp[i - 1][w];
      if (cost <= w) {
        const take = dp[i - 1][w - cost] + co2;
        if (take > dp[i][w]) dp[i][w] = take;
      }
    }
  }
  const selected: T[] = [];
  let w = W;
  for (let i = n; i >= 1; i--) {
    if (dp[i][w] !== dp[i - 1][w]) { selected.push(items[i - 1]); w -= items[i - 1].cost; }
  }
  selected.reverse();
  return finish(selected, n * (W + 1), 0, t0);
}

/** Greedy by CO2-per-cost ratio. O(n log n). Fast but not guaranteed optimal. */
export function knapsackGreedy<T extends Item>(items: T[], budget: number): Solution<T> {
  const t0 = now();
  const selected: T[] = [];
  let remaining = budget;
  [...items].sort((a, b) => b.co2 / b.cost - a.co2 / a.cost).forEach((it) => {
    if (it.cost <= remaining) { selected.push(it); remaining -= it.cost; }
  });
  return finish(selected, 0, 0, t0);
}

/**
 * Branch and bound over the include/exclude decision tree. A branch is cut when its
 * fractional-relaxation upper bound cannot beat the best solution found so far.
 * Finds the same optimum as DP, usually visiting far fewer than 2^n nodes.
 */
export function knapsackBranchAndBound<T extends Item>(items: T[], budget: number): Solution<T> {
  const t0 = now();
  const order = items.map((_, i) => i).sort((x, y) => items[y].co2 / items[y].cost - items[x].co2 / items[x].cost);
  let best = 0;
  let bestSet: number[] = [];
  let explored = 0;
  let pruned = 0;
  const chosen: number[] = [];

  const bound = (i: number, cost: number, benefit: number) => {
    let room = budget - cost;
    let b = benefit;
    for (let j = i; j < order.length; j++) {
      const it = items[order[j]];
      if (it.cost <= room) { room -= it.cost; b += it.co2; }
      else { b += it.co2 * (room / it.cost); break; }
    }
    return b;
  };

  const walk = (i: number, cost: number, benefit: number) => {
    explored++;
    if (benefit > best) { best = benefit; bestSet = chosen.slice(); }
    if (i === order.length) return;
    if (bound(i, cost, benefit) <= best) { pruned++; return; }
    const it = items[order[i]];
    if (cost + it.cost <= budget) {
      chosen.push(order[i]);
      walk(i + 1, cost + it.cost, benefit + it.co2);
      chosen.pop();
    } else pruned++;
    walk(i + 1, cost, benefit);
  };
  walk(0, 0, 0);
  return finish(bestSet.map((i) => items[i]), explored, pruned, t0);
}
