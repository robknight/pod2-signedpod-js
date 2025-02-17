export function* zip<A, B>(a: A[], b: B[]): Generator<[A, B]> {
  const iterators = [a[Symbol.iterator](), b[Symbol.iterator]()];
  while (true) {
    const nexts = iterators.map((i) => i.next());
    const done = nexts.some((n) => n.done);
    if (done) return;
    const values = nexts.map((n) => n.value);
    yield values as [A, B];
  }
}
