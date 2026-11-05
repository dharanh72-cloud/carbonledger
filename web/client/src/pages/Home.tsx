/* Moss Circuit: near-black observability console, signal emerald verification, visible algorithm evidence, dense but legible product UI. */
import { useMemo, useState } from "react";
import {
  Activity, ArrowDown, ArrowRight, Check, ChevronDown, CircleAlert, Clock3, Code2, Cpu, Database, Download, GitBranch, Hash, Leaf, Menu, Network, Play, RotateCcw, Search, ShieldCheck, Sparkles, Terminal, Trophy, TreePine, X, Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  AVLTree, HashTable, MaxHeap, Trie, catalogTrie, checkDemo, checkLedger, demoClaims, demoLeaderboard, groupRoot,
  knapsackBranchAndBound, knapsackDP, knapsackGreedy, makeDemoRecord, seedDemoLedger, sha256Hex, shortRoot, type DemoRecord,
} from "@/lib/dsa";

type Project = { id: string; name: string; cost: number; co2: number; icon: string; color: string };
type Algorithm = "DP" | "Greedy" | "Branch & Bound";

const reportUrl = "/carbonledger-live-report.pdf";

const projects: Project[] = [
  { id: "solar", name: "Solar microgrid", cost: 180, co2: 72, icon: "☼", color: "#8BFF63" },
  { id: "trees", name: "Tree plantation", cost: 95, co2: 44, icon: "♧", color: "#62D9A4" },
  { id: "led", name: "LED retrofit", cost: 65, co2: 26, icon: "◌", color: "#C7FF57" },
  { id: "mangrove", name: "Mangrove restoration", cost: 140, co2: 61, icon: "≈", color: "#55C8C1" },
  { id: "bike", name: "Bike-share program", cost: 110, co2: 33, icon: "⌁", color: "#A7E88D" },
  { id: "rain", name: "Rainwater capture", cost: 75, co2: 21, icon: "◒", color: "#7ED7FF" },
];

const knownActions = ["solar_panel_installed", "tree_planted", "led_bulbs_switch", "energy_saved_kwh", "smart_thermostat_installed", "appliance_unplugged", "renewable_energy_purchase", "bicycle_commute", "carpool_trip", "public_transport_used", "ev_charger_added", "work_from_home_day", "flight_avoided", "compost_started", "rainwater_harvesting", "plastic_recycled", "e_waste_recycled", "water_conserved", "reusable_bottle_used", "meat_free_day", "local_produce_bought", "urban_garden_started", "paper_reduction", "waste_audit_completed", "green_procurement", "emissions_report_filed"];
function normalizeEcoAction(value: string) { return value.trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/_+/g, "_"); }
const knownActionTrie = (() => { const trie = new Trie<true>(); knownActions.forEach((action) => trie.insert(action, true)); return trie; })();
function fmtMs(ms: number) { return ms < 0.01 ? "<0.01 ms" : `${ms.toFixed(2)} ms`; }

const structures = [
  { icon: Network, name: "Merkle tree", key: "01", purpose: "Tamper-evident ledger", complexity: "O(n) rebuild · O(log n) locate", copy: "Change one record and the root changes. Compare trusted and current branches to locate the mismatch.", evidence: "ROOT → BRANCH → LEAF" },
  { icon: GitBranch, name: "AVL tree", key: "02", purpose: "Sorted user registry", complexity: "O(log n) insert / search", copy: "Every new contributor keeps the registry balanced, even when IDs arrive in alphabetical order.", evidence: "LL · RR · LR · RL" },
  { icon: Search, name: "Trie", key: "03", purpose: "Action autocomplete", complexity: "O(L) lookup", copy: "A prefix becomes a path. Search known eco-actions by characters, not by scanning the whole catalog.", evidence: "SOL → SOLAR → ..." },
  { icon: Hash, name: "Hash table", key: "04", purpose: "Duplicate-claim check", complexity: "O(1) average lookup", copy: "User plus action becomes a claim fingerprint. A second identical claim is rejected before commit.", evidence: "MAYA + SOLAR = 9E04" },
  { icon: Trophy, name: "Max-heap", key: "05", purpose: "Top-K leaderboard", complexity: "O(n) build · O(k log n)", copy: "Pull the highest contributors without sorting every record. The heap keeps the next winner at the root.", evidence: "420 → 310 → 180" },
  { icon: Cpu, name: "Knapsack", key: "06", purpose: "Green-fund allocation", complexity: "DP O(n · W)", copy: "Choose projects under a fixed budget. Compare optimal DP with fast Greedy and pruned Branch & Bound.", evidence: "W = ₹220 / DP 87 vs GREEDY 70" },
];

function solve(items: Project[], budget: number, algorithm: Algorithm) {
  const run = algorithm === "DP" ? knapsackDP : algorithm === "Greedy" ? knapsackGreedy : knapsackBranchAndBound;
  const r = run(items, budget);
  return { selected: r.selected, explored: r.explored, pruned: r.pruned, ms: r.ms };
}

function ThreeDOrbit() {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  return <div className="orbit-stage" aria-label="3D visualization of the CarbonLedger proof network" onPointerMove={(event) => { const box = event.currentTarget.getBoundingClientRect(); setTilt({ x: (event.clientX - box.left) / box.width - 0.5, y: (event.clientY - box.top) / box.height - 0.5 }); }} onPointerLeave={() => setTilt({ x: 0, y: 0 })} style={{ transform: `rotateX(${tilt.y * -9}deg) rotateY(${tilt.x * 12}deg)` }}><div className="orbit-shadow" /><div className="orbit-core"><span className="core-glyph">⌬</span><small>ROOT</small></div><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-ring ring-three" /><div className="orbit-node node-one">M</div><div className="orbit-node node-two">H</div><div className="orbit-node node-three">K</div></div>;
}

type WorkspaceForm = { userId: string; userName: string; ecoAction: string; projectCategory: string; co2Benefit: string; fundAmount: string; occurredAt: string; notes: string };
type LocalRecord = Omit<WorkspaceForm, "occurredAt" | "co2Benefit" | "fundAmount"> & { id: number; occurredAt: number; co2Benefit: number; fundAmount: number; leafHash: string; createdAt: number; updatedAt: number };
const LOCAL_LEDGER_KEY = "carbonledger-live-local-records-v1";
const blankWorkspaceForm: WorkspaceForm = { userId: "", userName: "", ecoAction: "", projectCategory: "", co2Benefit: "", fundAmount: "", occurredAt: new Date().toISOString().slice(0, 10), notes: "" };

type WorkspaceView = "records" | "integrity" | "leaderboard";
const LEAF_PREFIX = "s2:";
function leafFields(r: Pick<LocalRecord, "userId" | "userName" | "ecoAction" | "projectCategory" | "co2Benefit" | "fundAmount" | "occurredAt" | "notes">) {
  return { userId: r.userId, userName: r.userName, ecoAction: r.ecoAction, projectCategory: r.projectCategory, co2Benefit: r.co2Benefit, fundAmount: r.fundAmount, occurredAt: r.occurredAt, notes: r.notes };
}
/** Leaf hash of a record's fields: SHA-256 over a canonical string. */
function localFingerprint(input: unknown) { return LEAF_PREFIX + sha256Hex(`carbonledger|leaf|v2|${JSON.stringify(input)}`); }
/** Pre-SHA-256 fingerprint, kept only to migrate records saved by earlier versions. */
function legacyFingerprint(input: unknown) {
  const source = JSON.stringify(input);
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) { hash ^= source.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return Array.from({ length: 8 }, (_, index) => ((hash + index * 2654435761) >>> 0).toString(16).padStart(8, "0")).join("");
}
/** Upgrades a legacy record's hash, but only if the legacy hash was still valid (a tampered legacy record stays flagged). */
function migrateLeaf(record: LocalRecord): LocalRecord {
  if (typeof record.leafHash === "string" && record.leafHash.startsWith(LEAF_PREFIX)) return record;
  return record.leafHash === legacyFingerprint(leafFields(record)) ? { ...record, leafHash: localFingerprint(leafFields(record)) } : record;
}
function readLocalRecords(): LocalRecord[] {
  try { const raw = localStorage.getItem(LOCAL_LEDGER_KEY); return raw ? (JSON.parse(raw) as LocalRecord[]).map(migrateLeaf) : []; } catch { return []; }
}
function LedgerWorkspace({ onClose, initialView = "records", embedded = false }: { onClose: () => void; initialView?: WorkspaceView; embedded?: boolean }) {
  const [form, setForm] = useState<WorkspaceForm>(blankWorkspaceForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<WorkspaceView>(initialView);
  const [records, setRecords] = useState<LocalRecord[]>(() => readLocalRecords());
  const [notice, setNotice] = useState("");
  const [backupInput, setBackupInput] = useState<HTMLInputElement | null>(null);
  const persist = (next: LocalRecord[]) => { setRecords(next); localStorage.setItem(LOCAL_LEDGER_KEY, JSON.stringify(next)); };
  const filteredRecords = records.filter((record) => !search.trim() || `${record.userId} ${record.userName} ${record.ecoAction}`.toLowerCase().includes(search.toLowerCase()));
  const leaderboard = useMemo(() => {
    const registry = new AVLTree<{ userId: string; userName: string; co2: number; fund: number; records: number }>();
    records.forEach((record) => registry.upsert(record.userId, (row) => { const next = row ?? { userId: record.userId, userName: record.userName, co2: 0, fund: 0, records: 0 }; next.co2 += record.co2Benefit; next.fund += record.fundAmount; next.records += 1; return next; }));
    const heap = MaxHeap.from(registry.inorder().map(([, row]) => ({ priority: row.co2, value: row })));
    return heap.topK(heap.size).map((entry) => entry.value);
  }, [records]);
  const claims = useMemo(() => { const table = new HashTable<number>(); records.forEach((record) => table.set(`${record.userId}|${record.ecoAction}`, record.id)); return table; }, [records]);
  const ledgerCheck = useMemo(() => checkLedger(records.map((record) => record.leafHash), records.map((record) => localFingerprint(leafFields(record)))), [records]);
  const integrityIssues = ledgerCheck.tampered.map((index) => records[index]).filter(Boolean);
  function setField(field: keyof WorkspaceForm, value: string) { setForm((current) => ({ ...current, [field]: value })); }
  function clearForm() { setEditingId(null); setForm(blankWorkspaceForm); setNotice(""); }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const normalized = { ...form, userId: form.userId.replace(/\s/g, ""), ecoAction: normalizeEcoAction(form.ecoAction), co2Benefit: Number(form.co2Benefit), fundAmount: Number(form.fundAmount || 0), occurredAt: new Date(`${form.occurredAt}T00:00:00Z`).getTime(), notes: form.notes || "" };
    if (!normalized.userId || !normalized.userName || !normalized.ecoAction || !normalized.projectCategory || normalized.co2Benefit <= 0 || Number.isNaN(normalized.occurredAt)) return;
    const claimedBy = claims.get(`${normalized.userId}|${normalized.ecoAction}`); const duplicate = claimedBy !== undefined && claimedBy !== editingId;
    if (duplicate) { setNotice("Duplicate claim rejected: this user has already logged this eco-action on this laptop."); return; }
    const now = Date.now();
    const nextRecord: LocalRecord = { ...normalized, id: editingId ?? now, leafHash: localFingerprint(leafFields(normalized)), createdAt: editingId ? (records.find((record) => record.id === editingId)?.createdAt ?? now) : now, updatedAt: now };
    persist(editingId ? records.map((record) => record.id === editingId ? nextRecord : record) : [nextRecord, ...records]);
    setNotice(editingId ? "Record updated in this laptop's local ledger." : "Record saved locally in this browser.");
    clearForm();
  }
  function editRecord(record: LocalRecord) { setEditingId(record.id); setForm({ userId: record.userId, userName: record.userName, ecoAction: record.ecoAction, projectCategory: record.projectCategory, co2Benefit: String(record.co2Benefit), fundAmount: String(record.fundAmount), occurredAt: new Date(record.occurredAt).toISOString().slice(0, 10), notes: record.notes }); setView("records"); }
  function removeRecord(id: number) { if (window.confirm("Delete this local record?")) { persist(records.filter((record) => record.id !== id)); setNotice("Record deleted from local storage."); } }
  function exportRecords() { const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "carbonledger-local-records.json"; anchor.click(); URL.revokeObjectURL(url); }
  function importRecords(event: React.ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const incoming = JSON.parse(String(reader.result)); if (!Array.isArray(incoming)) throw new Error("Invalid backup"); persist(incoming.map(migrateLeaf)); setNotice(`Restored ${incoming.length} local record(s).`); } catch { setNotice("Restore failed. Choose a CarbonLedger JSON backup file."); } }; reader.readAsText(file); event.target.value = ""; }
  const totalCo2 = records.reduce((sum, record) => sum + record.co2Benefit, 0);
  const totalFund = records.reduce((sum, record) => sum + record.fundAmount, 0);
  return <div className={embedded ? "workspace-embedded" : "workspace-overlay"} role={embedded ? undefined : "dialog"} aria-modal={embedded ? undefined : true} aria-label="Local Ledger Workspace"><div className={embedded ? "workspace-panel workspace-inline-panel" : "workspace-panel"}>
    <div className="workspace-header"><div><div className="section-kicker">LEDGER WORKSPACE / LOCAL LAPTOP STORAGE</div><h2>Record the proof trail.</h2><p>Entries stay in this browser on this laptop. No central database or sign-in is required.</p></div><button className="workspace-close" onClick={onClose} aria-label="Close workspace"><X size={18} /></button></div>
    <div className="local-storage-banner"><span className="local-dot" /> OFFLINE LOCAL MODE <small>Stored in browser localStorage · export backups regularly</small></div>
    <div className="workspace-tabs"><button className={view === "records" ? "active" : ""} onClick={() => setView("records")}>Records</button><button className={view === "integrity" ? "active" : ""} onClick={() => setView("integrity")}>Integrity</button><button className={view === "leaderboard" ? "active" : ""} onClick={() => setView("leaderboard")}>Leaderboard</button></div>
    <div className="workspace-summary"><div><span>RECORDS</span><strong>{records.length}</strong></div><div><span>CO₂ BENEFIT</span><strong>{totalCo2} kg</strong></div><div><span>FUND TRACKED</span><strong>₹{totalFund}</strong></div><div><span>STORAGE</span><strong>LOCAL</strong></div></div>
    {notice && <p className="workspace-notice">{notice}</p>}
    {view === "integrity" ? <div className="workspace-view-card"><div className="panel-label">INTEGRITY VERIFICATION <span>{integrityIssues.length ? "REVIEW REQUIRED" : "ALL LEAVES PRESENT"}</span></div><div className={`integrity-banner ${integrityIssues.length ? "warning" : "ok"}`}><ShieldCheck size={22} /><div><strong>{integrityIssues.length ? "Integrity needs review" : "Local ledger verified"}</strong><p>{records.length === 0 ? "No records yet. Save one to build the Merkle tree." : integrityIssues.length ? `${integrityIssues.length} record(s) changed outside the normal form: ${integrityIssues.map((record) => `#${record.id}`).join(", ")}. Located with ${ledgerCheck.visited} Merkle node comparison(s) across ${records.length} leaves.` : `Merkle root ${ledgerCheck.liveRoot.slice(0, 16)}… rebuilt from live fields matches all ${records.length} stored leaves.`}</p></div></div><div className="integrity-list">{records.slice(0, 8).map((record) => <div key={record.id}><span>#{record.id} · {record.userId} · {record.ecoAction}{integrityIssues.includes(record) ? " · MODIFIED" : ""}</span><code>{record.leafHash.slice(0, 16)}…</code></div>)}</div></div>
    : view === "leaderboard" ? <div className="workspace-view-card"><div className="panel-label">TOP CONTRIBUTORS <span>{leaderboard.length} USERS</span></div>{leaderboard.length === 0 ? <div className="workspace-empty">No contributor records yet.</div> : <div className="workspace-leaderboard">{leaderboard.map((row, index) => <div key={row.userId}><b>0{index + 1}</b><span><strong>{row.userName}</strong><small>{row.userId} · {row.records} records</small></span><em>{row.co2} kg<small>₹{row.fund}</small></em></div>)}</div>}</div>
    : <div className="workspace-layout"><form className="record-form" onSubmit={submit}><div className="panel-label">{editingId ? "EDIT RECORD" : "NEW ECO-ACTION"}<span>{editingId ? `#${editingId}` : "MANUAL ENTRY"}</span></div><label>User ID / department<input value={form.userId} onChange={(e) => setField("userId", e.target.value.replace(/\s/g, ""))} placeholder="" required /></label><label>User name<input value={form.userName} onChange={(e) => setField("userName", e.target.value)} placeholder="" required /></label><label>Eco-action<input list="known-actions" value={form.ecoAction} onChange={(e) => setField("ecoAction", e.target.value)} placeholder="" /><datalist id="known-actions">{knownActionTrie.autocomplete(normalizeEcoAction(form.ecoAction)).map(([action]) => <option key={action} value={action} />)}</datalist><small className="field-help">Spaces, hyphens, and uppercase text are normalized before saving.</small></label><div className="form-two"><label>Project / category<input value={form.projectCategory} onChange={(e) => setField("projectCategory", e.target.value)} placeholder="" required /></label><label>Date<input type="date" value={form.occurredAt} onChange={(e) => setField("occurredAt", e.target.value)} required /></label></div><div className="form-two"><label>CO₂ benefit (kg)<input type="number" min="0" step="0.01" value={form.co2Benefit} onChange={(e) => setField("co2Benefit", e.target.value)} placeholder="" required /></label><label>Fund amount (₹)<input type="number" min="0" step="0.01" value={form.fundAmount} onChange={(e) => setField("fundAmount", e.target.value)} placeholder="" /></label></div><label>Notes<textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="Verification details, location, or evidence…" rows={3} /></label><div className="form-actions"><button className="btn btn-primary" type="submit">{editingId ? "Update record" : "Save"}</button><button className="btn btn-ghost" type="button" onClick={clearForm}>Clear</button></div></form><div className="records-panel"><div className="records-toolbar"><div className="panel-label">LOCAL RECORDS <span>{filteredRecords.length} RESULTS</span></div><div className="record-actions"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search local records" aria-label="Search local records" /><button className="btn btn-ghost" type="button" onClick={exportRecords}>Export</button></div></div><div className="local-backup-actions"><button type="button" className="btn btn-ghost" onClick={exportRecords}>Download backup</button><button type="button" className="btn btn-ghost" onClick={() => backupInput?.click()}>Restore backup</button><input ref={setBackupInput} type="file" accept="application/json" onChange={importRecords} hidden /></div>{filteredRecords.length === 0 ? <div className="workspace-empty">No local records yet. Use the form to create the first proof entry.</div> : <div className="record-list">{filteredRecords.map((record) => <article className="record-item" key={record.id}><div><b>{record.userName}</b><span>{record.userId} · {record.ecoAction}</span><small>{record.projectCategory} · {new Date(record.occurredAt).toLocaleDateString()}</small></div><div className="record-impact"><strong>{record.co2Benefit} kg</strong><small>₹{record.fundAmount}</small></div><div className="record-item-actions"><button type="button" onClick={() => editRecord(record)}>Edit</button><button type="button" className="danger-action" onClick={() => removeRecord(record.id)}>Delete</button></div></article>)}</div>}</div></div>}
  </div></div>;
}
function NetworkField() {
  const dots = Array.from({ length: 22 }, (_, i) => ({ left: `${(i * 47) % 97}%`, top: `${(i * 31) % 84 + 8}%`, delay: `${(i % 5) * 0.7}s` }));
  return <div className="network-field" aria-hidden="true"><svg viewBox="0 0 1000 580" preserveAspectRatio="none"><path d="M42 408 L180 300 L310 360 L470 190 L615 275 L760 145 L930 225" /><path d="M180 300 L260 120 L470 190 L530 480 L760 145" /><path d="M310 360 L530 480 L930 225" /></svg>{dots.map((dot, i) => <span key={i} style={dot} />)}</div>;
}

export default function Home() {
  const [activeStructure, setActiveStructure] = useState(0);
  const [demoRecords, setDemoRecords] = useState<DemoRecord[]>(() => seedDemoLedger());
  const [terminalLines, setTerminalLines] = useState<string[]>(() => ["boot carbonledger --live", "loading structures... [ok]", `ledger root ${shortRoot(checkDemo(seedDemoLedger()).trustedRoot)} [verified]`]);
  const [terminalBusy, setTerminalBusy] = useState(false);
  const demoCheck = useMemo(() => checkDemo(demoRecords), [demoRecords]);
  const integrity: "OK" | "TAMPERED" = demoCheck.ok ? "OK" : "TAMPERED";
  const [budget, setBudget] = useState(220);
  const [algorithm, setAlgorithm] = useState<Algorithm>("DP");
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => Object.fromEntries(projects.map((p) => [p.id, true])));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceView>("records");

  const enabledProjects = useMemo(() => projects.filter((p) => enabled[p.id]), [enabled]);
  const result = useMemo(() => solve(enabledProjects, budget, algorithm), [enabledProjects, budget, algorithm]);
  const totalCost = result.selected.reduce((s, p) => s + p.cost, 0);
  const totalBenefit = result.selected.reduce((s, p) => s + p.co2, 0);
  const comparison = useMemo(() => ["DP", "Greedy", "Branch & Bound"].map((name) => { const r = solve(enabledProjects, budget, name as Algorithm); return { name, cost: r.selected.reduce((s, p) => s + p.cost, 0), benefit: r.selected.reduce((s, p) => s + p.co2, 0), count: r.selected.length }; }), [enabledProjects, budget]);

  function appendTerminal(action: string, output: string | string[]) {
    setTerminalBusy(true);
    setTimeout(() => { setTerminalLines((lines) => [...lines, `$ ${action}`, ...(Array.isArray(output) ? output : [output])]); setTerminalBusy(false); }, 250);
  }
  function simLog() {
    const command = 'log --user "Joy Boy" --action "Tree Planted"';
    const action = normalizeEcoAction("Tree Planted");
    const co2 = catalogTrie.lookup(action);
    if (co2 === undefined) { appendTerminal(command, `REJECTED / unknown action "${action}" [trie lookup]`); return; }
    if (demoClaims(demoRecords).has(`joyboy|${action}`)) { appendTerminal(command, `REJECTED / duplicate claim detected [hash table] · joyboy already logged ${action}`); return; }
    const record = makeDemoRecord(demoRecords.length + 1, "joyboy", "Joy Boy", action, co2);
    const next = [...demoRecords, record];
    setDemoRecords(next);
    appendTerminal(command, [`normalized action: ${action} · catalog hit ${co2} kg [trie]`, `record #${record.id} committed [leaf ${record.leafHash.slice(0, 8)}] · root ${shortRoot(checkDemo(next).trustedRoot)}`]);
  }
  function simDuplicate() {
    const command = 'claim --user "Maya Chen" --action "solar panel installed"';
    const action = normalizeEcoAction("solar panel installed");
    const existing = demoClaims(demoRecords).get(`maya|${action}`);
    appendTerminal(command, existing ? `REJECTED / duplicate claim detected [hash table] · maya already holds ${action} (#${existing})` : `ACCEPTED / no earlier claim for ${action}`);
  }
  function simTamper() {
    const target = demoRecords[2];
    const command = `attack --record #${target.id}`;
    if (target.co2Benefit !== target.trustedCo2) { appendTerminal(command, `already modified / co2 ${target.trustedCo2} → ${target.co2Benefit} kg`); return; }
    setDemoRecords(demoRecords.map((record, index) => (index === 2 ? { ...record, co2Benefit: 999 } : record)));
    appendTerminal(command, `WARNING / co2 field mutated ${target.trustedCo2} → 999 kg without hash update`);
  }
  function simVerify() {
    if (demoCheck.ok) { appendTerminal("verify --deep", [`OK / ledger intact / root ${shortRoot(demoCheck.liveRoot)} matches`, `compared ${demoCheck.visited} node · ${demoRecords.length} leaves`]); return; }
    const lines = demoCheck.tampered.map((index) => `TAMPERED / mismatch located at record #${demoRecords[index].id} · co2 ${demoRecords[index].trustedCo2} → ${demoRecords[index].co2Benefit} kg`);
    appendTerminal("verify --deep", [...lines, `located with ${demoCheck.visited} node comparisons across ${demoRecords.length} leaves [merkle]`]);
  }
  function simLeaderboard() {
    const board = demoLeaderboard(demoRecords, 3);
    appendTerminal("leaderboard --top 3", [board.rows.map((row, index) => `${String(index + 1).padStart(2, "0")} ${row.userName} ${row.co2.toFixed(1)} kg`).join(" | "), `[avl: ${board.users} users · height ${board.height} · ${board.rotations} rotation(s)] [heap: top 3]`]);
  }
  function toggleProject(id: string) { setEnabled((current) => ({ ...current, [id]: !current[id] })); }

  return <div className="live-app">
    <header className="live-nav"><a href="#top" className="brand"><span className="brand-mark"><Leaf size={18} /></span><span>CARBONLEDGER</span><b>LIVE</b></a><nav className={mobileOpen ? "mobile-open" : ""}><a href="#system">System</a><a href="#ledger">Manual entry</a><a href="#simulator">Simulator</a><a href="#solver">Knapsack lab</a><a href="#complexity">Complexity</a><button className="nav-workspace" onClick={() => { setWorkspaceMode("records"); setWorkspaceOpen(true); }}>Ledger Workspace</button><button className="nav-workspace nav-secondary" onClick={() => { setWorkspaceMode("integrity"); setWorkspaceOpen(true); }}>Integrity</button><button className="nav-workspace nav-secondary" onClick={() => { setWorkspaceMode("leaderboard"); setWorkspaceOpen(true); }}>Leaderboard</button></nav><div className="nav-actions"><span className="live-status"><i /> LIVE / LOCAL</span><a className="nav-report" href={reportUrl} download="carbonledger-live-report.pdf"><Download size={14} /> Report</a><button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation">{mobileOpen ? <X size={18} /> : <Menu size={18} />}</button></div></header>{workspaceOpen && <LedgerWorkspace initialView={workspaceMode} onClose={() => setWorkspaceOpen(false)} />} 

    <main id="top">
      <section className="hero"><NetworkField /><ThreeDOrbit /><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line" /> CLASSICAL STRUCTURES / PRACTICAL IMPACT</div><h1>Carbon<span>Ledger</span><sup>LIVE</sup></h1><p className="hero-sub">Tamper-proof carbon credit infrastructure powered by classical data structures.</p><p className="hero-note">A teaching system that makes integrity, duplicate detection, contributor ranking, and budget optimization visible in one place.</p><div className="hero-ctas"><a className="btn btn-primary" href="#system">Explore system <ArrowRight size={15} /></a><a className="btn btn-ghost" href="#solver"><Play size={14} /> Interactive demo</a><a className="text-link" href={reportUrl} download="carbonledger-live-report.pdf"><Download size={14} /> Download report</a></div></div><div className="hero-side"><div className="hero-side-label">SYSTEM STATUS</div><div className={`hero-pulse ${integrity === "OK" ? "healthy" : "warning"}`}><span /> {integrity === "OK" ? "INTEGRITY VERIFIED" : "TAMPER DETECTED"}</div><div className="hero-hash">{groupRoot(demoCheck.liveRoot)}<br /><small>ROOT HASH / LIVE DEMO LEDGER · {demoRecords.length} RECORDS</small></div><div className="hero-stat-row"><span><strong>06</strong> structures</span><span><strong>04</strong> algorithms</span></div></div><div className="scroll-cue"><ArrowDown size={14} /> SCROLL TO TRACE THE SYSTEM</div></section>

      <section className="problem-strip"><div className="section-kicker">00 / WHY IT EXISTS</div><div className="problem-grid"><div><h2>Carbon claims are only as credible as the trail behind them.</h2></div><div className="problem-item"><CircleAlert size={18} /><div><b>Tampering</b><p>One altered record can quietly corrupt a report.</p></div></div><div className="problem-item"><Hash size={18} /><div><b>Double claims</b><p>The same action should never earn points twice.</p></div></div><div className="problem-item"><TargetIcon /><div><b>Fund waste</b><p>Good intentions still need optimal allocation.</p></div></div></div></section>

      <section id="system" className="system-section section-shell"><div className="section-heading"><div><div className="section-kicker">01 / THE ARCHITECTURE</div><h2>Six structures.<br /><em>One accountable system.</em></h2></div><p>CarbonLedger is not a black box. Each classical structure owns one observable responsibility, from the record leaf to the leaderboard root.</p></div><div className="structure-grid">{structures.map((s, i) => { const Icon = s.icon; const open = activeStructure === i; return <button key={s.name} className={`structure-card ${open ? "open" : ""}`} onClick={() => setActiveStructure(open ? -1 : i)}><div className="structure-top"><span className="structure-number">{s.key}</span><Icon size={20} /><ChevronDown size={15} className="structure-chevron" /></div><h3>{s.name}</h3><div className="structure-purpose">{s.purpose}</div>{open && <div className="structure-detail"><div className="complexity">{s.complexity}</div><div className="evidence-chip">{s.evidence}</div><p>{s.copy}</p><div className="mini-visual"><span /><span /><span /><span /><span /></div></div>}</button>; })}</div></section>

      <section id="ledger" className="ledger-section section-shell"><div className="section-heading compact"><div><div className="section-kicker">02 / MANUAL LEDGER ENTRY</div><h2>Write the proof trail<br /><em>by hand.</em></h2></div><p>Use the form below to enter an eco-action directly. Records stay in this browser on this laptop. Use Download backup to move them to another machine.</p></div><div className="manual-entry-grid"><div className="manual-3d-card"><div className="manual-3d-label">LIVE RECORD OBJECT / SHA-256 LEAF</div><div className="manual-cube-scene"><div className="manual-cube"><span>USER</span><span>ACTION</span><span>CO₂</span><span>HASH</span><span>DATE</span><span>FUND</span></div><div className="manual-cube-orbit orbit-a" /><div className="manual-cube-orbit orbit-b" /></div><div className="manual-3d-footer"><span><i /> 3D PROOF OBJECT</span><b>Every saved entry gets its own fingerprint</b></div></div><LedgerWorkspace embedded onClose={() => undefined} /></div></section><section id="simulator" className="simulator-section section-shell"><div className="section-heading compact"><div><div className="section-kicker">02 / LIVE SYSTEM SIMULATOR</div><h2>Read the ledger<br /><em>as it computes.</em></h2></div><p>These actions mirror the C program’s viva walkthrough. Click one. Watch the evidence arrive.</p></div><div className="simulator-grid"><div className="terminal-window"><div className="terminal-bar"><span className="terminal-dots"><i /><i /><i /></span><span><Terminal size={13} /> carbonledger / stdout</span><span className="terminal-live">● recording</span></div><div className="terminal-output" aria-live="polite">{terminalLines.map((line, i) => <div key={`${line}-${i}`} className={line.includes("TAMPERED") ? "terminal-danger" : line.includes("verified") || line.includes("OK") ? "terminal-success" : ""}><span className="line-no">{String(i + 1).padStart(2, "0")}</span>{line}</div>)}{terminalBusy && <div className="typing"><span /> <span /> <span /></div>}</div></div><div className="sim-controls"><div className="sim-status"><div className="status-ring"><ShieldCheck size={24} /></div><div><span>MERKLE ROOT</span><strong className={integrity === "OK" ? "text-green" : "text-danger"}>{integrity === "OK" ? "MATCH / OK" : "MISMATCH / TAMPERED"}</strong></div></div><button disabled={terminalBusy} onClick={simLog}><Leaf size={15} /> Log eco-action <ArrowRight size={14} /></button><button disabled={terminalBusy} onClick={simDuplicate}><Hash size={15} /> Attempt duplicate claim <ArrowRight size={14} /></button><button disabled={terminalBusy} onClick={simTamper}><CircleAlert size={15} /> Simulate tampering <ArrowRight size={14} /></button><button disabled={terminalBusy} onClick={simVerify}><ShieldCheck size={15} /> Verify integrity <ArrowRight size={14} /></button><button disabled={terminalBusy} onClick={simLeaderboard}><Trophy size={15} /> Show leaderboard <ArrowRight size={14} /></button></div></div><div className="fraud-explainer"><div className="fraud-explainer-icon"><ShieldCheck size={21} /></div><div className="proof-stack" aria-hidden="true"><i /><i /><i /><span>H</span></div><div><div className="section-kicker">HOW FRAUD IS DETECTED</div><h3>One changed record. One changed root.</h3><p>CarbonLedger rebuilds each leaf from live fields, folds them into parent hashes, and compares the final root with the trusted snapshot. Matching branches are skipped; the mismatched branch narrows the search.</p></div><div className="fraud-steps"><span><b>01</b> record edit</span><ArrowRight size={13} /><span><b>02</b> leaf hash</span><ArrowRight size={13} /><span><b>03</b> root mismatch</span></div></div></section>

      <section id="solver" className="solver-section section-shell"><div className="section-heading"><div><div className="section-kicker">03 / OPTIMIZATION LAB</div><h2>Run the green-fund<br /><em>solver live.</em></h2></div><p>Toggle candidate projects, set a budget, and compare three strategies against exactly the same inputs.</p></div><div className="solver-layout"><div className="project-panel"><div className="panel-label">CANDIDATE PROJECTS <span>{enabledProjects.length}/6 ACTIVE</span></div>{projects.map((project) => <button key={project.id} className={`project-row ${enabled[project.id] ? "selected" : ""}`} onClick={() => toggleProject(project.id)}><span className="project-check">{enabled[project.id] && <Check size={13} />}</span><span className="project-icon" style={{ color: project.color }}>{project.icon}</span><span className="project-name">{project.name}</span><span className="project-cost">₹{project.cost}<small> / {project.co2} kg</small></span></button>)}<div className="budget-control"><div className="panel-label">AVAILABLE BUDGET <strong>₹{budget}</strong></div><input aria-label="Budget" type="range" min="50" max="500" step="5" value={budget} onChange={(e) => setBudget(Number(e.target.value))} /><div className="range-labels"><span>₹50</span><span>₹500</span></div></div></div><div className={`solver-output mode-${algorithm === "DP" ? "dp" : algorithm === "Greedy" ? "greedy" : "bnb"}`}><div className="solver-toolbar"><div className="algorithm-tabs">{(["DP", "Greedy", "Branch & Bound"] as Algorithm[]).map((a) => <button key={a} className={algorithm === a ? "active" : ""} onClick={() => setAlgorithm(a)}>{a}</button>)}</div><span className="run-state"><span /> RUN COMPLETE / {fmtMs(result.ms)}</span></div><div className="algorithm-explanation"><div className="algorithm-icon"><Zap size={18} /></div><div><strong>{algorithm === "DP" ? "Dynamic programming" : algorithm === "Greedy" ? "Greedy ratio sort" : "Branch & bound search"}</strong><p>{algorithm === "DP" ? "Filling a value table to guarantee the best total impact." : algorithm === "Greedy" ? "Taking the highest CO₂-per-rupee ratio first. Fast, but not always optimal." : "Exploring promising branches and pruning budgets that cannot beat the current best."}</p></div></div><div className="evidence-mode"><span className="evidence-mode-label">{algorithm === "DP" ? "TABLE CELLS" : algorithm === "Greedy" ? "RATIO RANKING" : "SEARCH TREE"}</span><div className="evidence-mode-visual">{Array.from({ length: algorithm === "DP" ? 12 : 8 }, (_, i) => <i key={i} className={i < (algorithm === "DP" ? 8 : algorithm === "Greedy" ? 5 : 6) ? "lit" : ""} />)}</div><span className="evidence-mode-copy">{algorithm === "DP" ? "Filling states across budget W" : algorithm === "Greedy" ? "Ordering impact / cost" : "Pruning weak branches"}</span></div><div className="selected-projects"><div className="panel-label">SELECTED SET <span>{result.selected.length} PROJECTS / {algorithm === "Branch & Bound" ? `${result.explored} NODES` : algorithm === "DP" ? "TABLE OPTIMAL" : "RATIO SORTED"}</span></div><div className="selected-bars">{projects.map((p) => <div key={p.id} className={`selected-bar ${result.selected.some((x) => x.id === p.id) ? "on" : ""}`}><span>{p.name}</span><div><i style={{ width: `${p.co2 / 72 * 100}%`, background: p.color }} /></div><small>{result.selected.some((x) => x.id === p.id) ? `₹${p.cost} · ${p.co2}kg` : "skipped"}</small></div>)}</div></div><div className="solver-metrics"><div><span>TOTAL COST</span><strong>₹{totalCost}</strong><small>of ₹{budget}</small></div><div><span>CO₂ BENEFIT</span><strong>{totalBenefit} kg</strong><small>avoided impact</small></div><div><span>{algorithm === "Branch & Bound" ? "NODES PRUNED" : "EFFICIENCY"}</span><strong>{algorithm === "Branch & Bound" ? result.pruned : `${Math.round(totalBenefit / Math.max(totalCost, 1) * 100)}%`}</strong><small>{algorithm === "Branch & Bound" ? "search space" : "impact / cost"}</small></div></div></div></div><div className="comparison-table"><div className="panel-label">STRATEGY COMPARISON <span>UPDATES WITH INPUTS</span></div><div className="comparison-head"><span>ALGORITHM</span><span>PROJECTS</span><span>TOTAL COST</span><span>CO₂ BENEFIT</span><span>RESULT</span></div>{comparison.map((row) => <div key={row.name} className={`comparison-row ${row.name === algorithm ? "current" : ""}`}><span><i className={`algo-dot ${row.name === "DP" ? "green" : row.name === "Greedy" ? "amber" : "blue"}`} />{row.name}</span><span>{row.count}</span><span>₹{row.cost}</span><span>{row.benefit} kg</span><span>{row.benefit === Math.max(...comparison.map((x) => x.benefit)) ? <b className="best"><Sparkles size={12} /> best impact</b> : "tradeoff"}</span></div>)}</div></section>

      <section id="complexity" className="complexity-section section-shell"><div className="section-heading compact"><div><div className="section-kicker">04 / PERFORMANCE PROFILE</div><h2>Evidence in<br /><em>Big-O.</em></h2></div><p>Classical structures are not ornamental here. They define the cost of each operation and make the system discussable.</p></div><div className="complexity-grid">{[["Insert user", "AVL tree", "O(log n)"], ["Duplicate check", "Hash table", "O(1) avg"], ["Action lookup", "Trie", "O(L)"], ["Leaderboard top-K", "Max-heap", "O(k log n)"], ["Verify ledger", "Merkle tree", "O(n)"], ["Allocate budget", "DP knapsack", "O(n · W)"]].map(([op, ds, bigO]) => <div className="complexity-row" key={op}><span>{op}</span><small>{ds}</small><strong>{bigO}</strong></div>)}</div></section>

      <section className="stack-section section-shell"><div><div className="section-kicker">05 / BUILT TO BE READ</div><h2>C99 underneath.<br /><em>Proof on top.</em></h2></div><div className="stack-right"><p>The original project stays deliberately dependency-free: GCC, standard library, raw binary persistence. This live layer turns that terminal workflow into a visual study tool without hiding the implementation.</p><div className="badges">{["C99", "GCC", "Merkle tree", "AVL", "Trie", "Hashing", "Max-heap", "DP / Greedy / B&B"].map((badge) => <span key={badge}><Check size={12} /> {badge}</span>)}</div></div></section>
    </main>

    <footer id="footer" className="live-footer"><div className="footer-brand"><span className="brand-mark"><Leaf size={18} /></span><div><strong>CARBONLEDGER <b>LIVE</b></strong><small>A tamper-proof carbon credit system</small></div></div><div className="footer-links"><a href="#system">System</a><a href="#solver">Knapsack lab</a><a href="#top">Back to top ↑</a></div><div className="footer-meta"><span>COLLEGE PROJECT / 2026</span><span>OFFLINE LOCAL STORAGE · LAPTOP ONLY</span></div></footer>
  </div>;
}

function TargetIcon() { return <div className="target-icon"><span /></div>; }
