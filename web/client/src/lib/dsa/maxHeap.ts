export interface HeapEntry<T> { priority: number; value: T }
interface Slot<T> extends HeapEntry<T> { seq: number }

/**
 * Array-based binary max-heap. `MaxHeap.from` builds in O(n) (bottom-up heapify);
 * extracting the top k costs O(k log n). Ties are broken by insertion order so results are deterministic.
 */
export class MaxHeap<T> {
  private a: Array<Slot<T>> = [];
  private seq = 0;

  static from<T>(entries: Array<HeapEntry<T>>): MaxHeap<T> {
    const heap = new MaxHeap<T>();
    heap.a = entries.map((e) => ({ ...e, seq: heap.seq++ }));
    for (let i = (heap.a.length >> 1) - 1; i >= 0; i--) heap.siftDown(i);
    return heap;
  }

  get size(): number { return this.a.length; }

  private before(x: Slot<T>, y: Slot<T>): boolean {
    return x.priority > y.priority || (x.priority === y.priority && x.seq < y.seq);
  }

  push(entry: HeapEntry<T>): void {
    this.a.push({ ...entry, seq: this.seq++ });
    let i = this.a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.before(this.a[i], this.a[parent])) break;
      [this.a[i], this.a[parent]] = [this.a[parent], this.a[i]];
      i = parent;
    }
  }

  pop(): HeapEntry<T> | undefined {
    if (this.a.length === 0) return undefined;
    const top = this.a[0];
    const last = this.a.pop()!;
    if (this.a.length > 0) { this.a[0] = last; this.siftDown(0); }
    return { priority: top.priority, value: top.value };
  }

  /** Top k entries, highest priority first. Does not modify this heap. */
  topK(k: number): Array<HeapEntry<T>> {
    const copy = new MaxHeap<T>();
    copy.a = this.a.slice();
    copy.seq = this.seq;
    const out: Array<HeapEntry<T>> = [];
    for (let i = 0; i < k; i++) { const e = copy.pop(); if (!e) break; out.push(e); }
    return out;
  }

  private siftDown(start: number): void {
    let i = start;
    const n = this.a.length;
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let best = i;
      if (l < n && this.before(this.a[l], this.a[best])) best = l;
      if (r < n && this.before(this.a[r], this.a[best])) best = r;
      if (best === i) return;
      [this.a[i], this.a[best]] = [this.a[best], this.a[i]];
      i = best;
    }
  }
}
