export type Evaluate<T> = T extends new (...args: any[]) => any
  ? T
  : T extends infer O
  ? { [K in keyof O]: O[K] }
  : never;
