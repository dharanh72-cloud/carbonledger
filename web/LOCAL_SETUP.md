# CarbonLedger Live — Offline Laptop Mode

This package stores manual ledger entries locally in your browser on this laptop. The visible Ledger Workspace does not require sign-in and does not call the central database. Use Save locally, Edit, Delete, Clear, Download backup, Restore backup, Integrity, and Leaderboard.

## Run locally

```bash
pnpm install
pnpm check
pnpm test
pnpm dev
```

Open the local URL printed in the terminal, usually `http://localhost:3000`.

Records are tied to the browser profile and laptop. Export a JSON backup regularly. Clearing browser site data or switching browsers will not automatically carry records over. The simulator, knapsack lab, report download, and 3D UI remain available.
