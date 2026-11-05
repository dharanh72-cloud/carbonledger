class TrieNode<V> {
  children = new Map<string, TrieNode<V>>();
  terminal = false;
  value: V | undefined;
}

/** Prefix tree. Lookup and insert are O(L) in the word length; autocomplete is O(L + matches). */
export class Trie<V> {
  private root = new TrieNode<V>();
  size = 0;

  insert(word: string, value: V): void {
    let node = this.root;
    for (const ch of word) {
      let next = node.children.get(ch);
      if (!next) { next = new TrieNode<V>(); node.children.set(ch, next); }
      node = next;
    }
    if (!node.terminal) this.size++;
    node.terminal = true;
    node.value = value;
  }

  private find(prefix: string): TrieNode<V> | undefined {
    let node: TrieNode<V> | undefined = this.root;
    for (const ch of prefix) { node = node.children.get(ch); if (!node) return undefined; }
    return node;
  }

  lookup(word: string): V | undefined {
    const node = this.find(word);
    return node?.terminal ? node.value : undefined;
  }

  has(word: string): boolean { return this.find(word)?.terminal === true; }

  /** All stored words starting with `prefix`, in alphabetical order. */
  autocomplete(prefix: string): Array<[string, V]> {
    const start = this.find(prefix);
    const out: Array<[string, V]> = [];
    if (!start) return out;
    const walk = (node: TrieNode<V>, path: string) => {
      if (node.terminal) out.push([path, node.value as V]);
      for (const ch of Array.from(node.children.keys()).sort()) walk(node.children.get(ch)!, path + ch);
    };
    walk(start, prefix);
    return out;
  }
}
