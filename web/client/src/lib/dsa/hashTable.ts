/** Hash table with separate chaining (djb2). O(1) average lookup; grows when load factor exceeds 0.75. */
export class HashTable<V> {
  private buckets: Array<Array<[string, V]>>;
  private count = 0;
  /** Number of inserts that landed in an already-occupied bucket. */
  collisions = 0;

  constructor(initialBuckets = 16) {
    this.buckets = Array.from({ length: initialBuckets }, () => []);
  }

  private index(key: string, buckets = this.buckets.length): number {
    let h = 5381;
    for (let i = 0; i < key.length; i++) h = (((h << 5) + h) + key.charCodeAt(i)) >>> 0;
    return h % buckets;
  }

  set(key: string, value: V): void {
    const chain = this.buckets[this.index(key)];
    const hit = chain.find(([k]) => k === key);
    if (hit) { hit[1] = value; return; }
    if (chain.length > 0) this.collisions++;
    chain.push([key, value]);
    this.count++;
    if (this.count / this.buckets.length > 0.75) this.grow();
  }

  get(key: string): V | undefined {
    return this.buckets[this.index(key)].find(([k]) => k === key)?.[1];
  }

  has(key: string): boolean {
    return this.buckets[this.index(key)].some(([k]) => k === key);
  }

  get size(): number { return this.count; }
  get loadFactor(): number { return this.count / this.buckets.length; }
  get maxChainLength(): number { return this.buckets.reduce((m, c) => Math.max(m, c.length), 0); }

  private grow(): void {
    const next: Array<Array<[string, V]>> = Array.from({ length: this.buckets.length * 2 }, () => []);
    for (const chain of this.buckets) for (const entry of chain) next[this.index(entry[0], next.length)].push(entry);
    this.buckets = next;
  }
}
