export type Rotation = "LL" | "RR" | "LR" | "RL";

class AVLNode<V> {
  left: AVLNode<V> | null = null;
  right: AVLNode<V> | null = null;
  height = 1;
  constructor(public key: string, public value: V) {}
}

const height = <V>(n: AVLNode<V> | null) => (n ? n.height : 0);
const balance = <V>(n: AVLNode<V> | null) => (n ? height(n.left) - height(n.right) : 0);
const refresh = <V>(n: AVLNode<V>) => { n.height = 1 + Math.max(height(n.left), height(n.right)); };

/** Self-balancing BST keyed by string. Insert/update/search are O(log n) in the worst case. */
export class AVLTree<V> {
  private root: AVLNode<V> | null = null;
  size = 0;
  rotations = 0;
  lastRotation: Rotation | null = null;

  /** Inserts or updates `key`. `fn` receives the existing value (or undefined) and returns the value to store. */
  upsert(key: string, fn: (existing: V | undefined) => V): V {
    let result!: V;
    const insert = (node: AVLNode<V> | null): AVLNode<V> => {
      if (!node) { this.size++; const created = new AVLNode(key, fn(undefined)); result = created.value; return created; }
      if (key === node.key) { node.value = fn(node.value); result = node.value; return node; }
      if (key < node.key) node.left = insert(node.left); else node.right = insert(node.right);
      return this.rebalance(node);
    };
    this.root = insert(this.root);
    return result;
  }

  get(key: string): V | undefined {
    let node = this.root;
    while (node) {
      if (key === node.key) return node.value;
      node = key < node.key ? node.left : node.right;
    }
    return undefined;
  }

  /** Entries sorted by key. */
  inorder(): Array<[string, V]> {
    const out: Array<[string, V]> = [];
    const walk = (n: AVLNode<V> | null) => { if (!n) return; walk(n.left); out.push([n.key, n.value]); walk(n.right); };
    walk(this.root);
    return out;
  }

  get height(): number { return height(this.root); }

  private note(r: Rotation) { this.rotations++; this.lastRotation = r; }

  private rotateRight(y: AVLNode<V>): AVLNode<V> {
    const x = y.left!; y.left = x.right; x.right = y; refresh(y); refresh(x); return x;
  }
  private rotateLeft(x: AVLNode<V>): AVLNode<V> {
    const y = x.right!; x.right = y.left; y.left = x; refresh(x); refresh(y); return y;
  }

  private rebalance(node: AVLNode<V>): AVLNode<V> {
    refresh(node);
    const b = balance(node);
    if (b > 1) {
      if (balance(node.left) < 0) { node.left = this.rotateLeft(node.left!); this.note("LR"); }
      else this.note("LL");
      return this.rotateRight(node);
    }
    if (b < -1) {
      if (balance(node.right) > 0) { node.right = this.rotateRight(node.right!); this.note("RL"); }
      else this.note("RR");
      return this.rotateLeft(node);
    }
    return node;
  }
}
