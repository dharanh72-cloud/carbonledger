import { sha256Hex } from "./sha256";

export interface MerkleNode {
  hash: string;
  left: MerkleNode | null;
  right: MerkleNode | null;
  /** First and last leaf index covered by this subtree. */
  lo: number;
  hi: number;
}

/**
 * Builds a Merkle tree bottom-up. Parent hash = SHA-256(leftHash + rightHash);
 * an unpaired node is paired with itself. A change to any leaf therefore changes
 * every hash on its path to the root.
 */
export function buildMerkle(leafHashes: string[]): MerkleNode | null {
  if (leafHashes.length === 0) return null;
  let layer: MerkleNode[] = leafHashes.map((hash, i) => ({ hash, left: null, right: null, lo: i, hi: i }));
  while (layer.length > 1) {
    const next: MerkleNode[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = layer[i + 1] ?? left;
      next.push({ hash: sha256Hex(left.hash + right.hash), left, right, lo: left.lo, hi: right.hi });
    }
    layer = next;
  }
  return layer[0];
}

/**
 * Walks the trusted and current trees together. A matching hash proves the whole
 * subtree is unchanged, so it is skipped; only mismatched branches are descended
 * into. One tampered leaf costs about 2*log2(n)+1 node comparisons, not n.
 */
export function locateTampered(trusted: MerkleNode | null, current: MerkleNode | null) {
  const indices: number[] = [];
  let visited = 0;
  const walk = (t: MerkleNode | null, c: MerkleNode | null) => {
    if (!t || !c) return;
    visited++;
    if (t.hash === c.hash) return;
    if (t.lo === t.hi) { indices.push(t.lo); return; }
    walk(t.left, c.left);
    // An unpaired node is paired with itself, so both children are the same node: descend once.
    if (t.right !== t.left) walk(t.right, c.right);
  };
  walk(trusted, current);
  return { indices, visited };
}

export interface CheckResult {
  ok: boolean;
  trustedRoot: string;
  liveRoot: string;
  /** Leaf indices whose live hash differs from the trusted hash. */
  tampered: number[];
  /** Node comparisons spent localising the tampering. */
  visited: number;
  /** True when records were added or removed outside the normal commit path. */
  countMismatch: boolean;
}

/** Compares leaf hashes stored at commit time with hashes recomputed from live data. */
export function checkLedger(trustedLeaves: string[], liveLeaves: string[]): CheckResult {
  const trusted = buildMerkle(trustedLeaves);
  const live = buildMerkle(liveLeaves);
  const trustedRoot = trusted?.hash ?? "";
  const liveRoot = live?.hash ?? "";

  if (trustedLeaves.length !== liveLeaves.length) {
    const common = Math.min(trustedLeaves.length, liveLeaves.length);
    const tampered: number[] = [];
    for (let i = 0; i < common; i++) if (trustedLeaves[i] !== liveLeaves[i]) tampered.push(i);
    return { ok: false, trustedRoot, liveRoot, tampered, visited: common, countMismatch: true };
  }
  if (trustedRoot === liveRoot) {
    return { ok: true, trustedRoot, liveRoot, tampered: [], visited: trusted ? 1 : 0, countMismatch: false };
  }
  const { indices, visited } = locateTampered(trusted, live);
  return { ok: false, trustedRoot, liveRoot, tampered: indices, visited, countMismatch: false };
}
