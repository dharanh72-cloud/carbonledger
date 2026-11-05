#!/bin/bash
# End-to-end tests: drive the real binary through scripted menu sessions.
# Usage: bash tests/smoke.sh ./carbonledger
BIN="$(cd "$(dirname "${1:-./carbonledger}")" && pwd)/$(basename "${1:-./carbonledger}")"
WORK="$(mktemp -d)"; cd "$WORK" || exit 1
pass=0; fail=0
ok()  { pass=$((pass+1)); echo "  ok   - $1"; }
bad() { fail=$((fail+1)); echo "  FAIL - $1"; }
run() { rm -f carbonledger.dat; printf "$1" | "$BIN" 2>&1; }
has() { echo "$1" | grep -qF -- "$2"; }

acts=(tree_planted solar_panel_installed led_bulbs_switch bicycle_commute compost_started rainwater_harvesting tree_planted bicycle_commute)
log_n() { local s=""; for ((i=0;i<$1;i++)); do s+="1\\nuser$i\\n${acts[$i]}\\n"; done; echo -n "$s"; }

echo "CarbonLedger smoke tests"

out=$(run "1\nalice\nTree Planted\n1\nbob\nsolar panel installed\n0\n")
has "$out" "[COMMITTED] tree_planted by alice" && ok "logs an action and normalises 'Tree Planted'" || bad "log + normalise case/space"
has "$out" "[COMMITTED] solar_panel_installed by bob" && ok "normalises spaces to underscores" || bad "normalise spaces"

out=$(printf "" | "$BIN" 2>&1 | head -c 20000 | wc -c)
[ "$out" -lt 5000 ] && ok "exits cleanly when input ends at the menu (no infinite loop)" || bad "EOF loop"

out=$(run "1\nalice\ntree_planted\n1\nalice\ntree_planted\n0\n")
has "$out" "duplicate" && ok "rejects a duplicate claim" || bad "duplicate rejection"

out=$(run "1\nalice\nnot_an_action\n0\n")
has "$out" "Unknown action" && ok "rejects an unknown action" || bad "unknown action"

out=$(run "$(log_n 3)0\n")
has "$out" "RR rotation" && ok "AVL rebalances (RR rotation) on sorted input" || bad "AVL rotation"

out=$(run "1\nalice\ntree_planted\n4\n0\n")
has "$out" "OK - ledger intact" && ok "verify passes on an untouched ledger" || bad "verify clean"

# Tamper at every index for several ledger sizes, including non powers of two.
allgood=1
for n in 1 2 3 4 5 6 7 8; do
  for ((idx=0; idx<n; idx++)); do
    out=$(run "$(log_n $n)5\n$idx\n999\n4\n0\n")
    found=$(echo "$out" | grep -E "Record [0-9]+ tampered" | sed -E 's/.*Record ([0-9]+) tampered.*/\1/' | tr '\n' ',')
    [ "$found" = "$idx," ] || { allgood=0; echo "       n=$n tamper=$idx reported [$found]"; }
  done
done
[ $allgood = 1 ] && ok "Merkle localises the exact tampered record (n=1..8, every index)" || bad "tamper localisation"

out=$(run "$(log_n 3)5\n1\n999\n4\n0\n")
has "$out" "Old CO2: 120.0 kg -> New CO2: 999.0 kg" && ok "tamper report shows old and new CO2" || bad "old/new CO2"

out=$(run "1\nalice\ntree_planted\n1\nbob\nsolar_panel_installed\n0\n"; printf "8\n4\n0\n" | "$BIN" 2>&1)
has "$out" "LOADED] 2 record(s) restored" && ok "persists and reloads records" || bad "persistence"

out=$(run "6\n150\n0\n")
has "$out" "DP (optimal):      560.0 kg CO2" && ok "knapsack DP optimum = 560 kg at budget 150" || bad "DP"
has "$out" "Greedy:             420.0 kg CO2" && ok "greedy is suboptimal (420 kg)" || bad "greedy"
has "$out" "Branch & Bound:     560.0 kg CO2" && ok "branch and bound matches DP" || bad "B&B"

rm -rf "$WORK"
echo "passed=$pass failed=$fail"
[ $fail -eq 0 ]
