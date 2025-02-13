import { poseidon2 } from "poseidon-lite/poseidon2";
import * as imt from "@zk-kit/lean-imt";

type Value = bigint;
type Evaluate<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
type MerkleProof = Evaluate<imt.LeanIMTMerkleProof<bigint>>;

function hashFunction(left: bigint, right: bigint): bigint {
  return poseidon2([left, right]);
}

export class POD2Dictionary {
  #tree: imt.LeanIMT<bigint>;

  public constructor(kv: Map<Value, Value>) {
    this.#tree = new imt.LeanIMT<bigint>(hashFunction);
    this.#tree.insertMany(
      Array.from(kv.entries())
        .sort((a, b) => (a[0] > b[0] ? 1 : -1))
        .flat()
    );
  }

  public commitment() {
    return this.#tree.root;
  }

  public get(key: Value) {
    const keyPos = this.#tree.indexOf(key);
    return this.#tree.leaves[keyPos + 1];
  }

  public prove(value: Value) {
    return this.#tree.generateProof(this.#tree.indexOf(value));
  }

  public verify(proof: MerkleProof) {
    return this.#tree.verifyProof(proof);
  }

  [Symbol.iterator](): IterableIterator<[Value, Value]> {
    const leaves = this.#tree.leaves;
    return (function* () {
      for (let i = 0; i < leaves.length; i += 2) {
        yield [leaves[i]!, leaves[i + 1]!];
      }
    })();
  }

  public equals(other: POD2Dictionary) {
    return this.commitment() === other.commitment();
  }
}

const EMPTY = 0n; // ?? what should this be?

export class POD2Set {
  #tree: imt.LeanIMT<bigint>;

  public constructor(values: Value[]) {
    this.#tree = new imt.LeanIMT<bigint>(hashFunction);
    const leaves = [];
    for (const value of values) {
      leaves.push(value, EMPTY);
    }
    this.#tree.insertMany(leaves.sort((a, b) => (a > b ? 1 : -1)));
  }

  public commitment() {
    return this.#tree.root;
  }

  public prove(value: Value) {
    return this.#tree.generateProof(this.#tree.indexOf(value));
  }

  public verify(proof: MerkleProof) {
    return this.#tree.verifyProof(proof);
  }

  [Symbol.iterator](): IterableIterator<Value> {
    return this.#tree.leaves.values();
  }
}

export class POD2Array {
  #tree: imt.LeanIMT<bigint>;

  public constructor(values: Value[]) {
    this.#tree = new imt.LeanIMT<bigint>(hashFunction);
    const leaves = values.flatMap((val, idx) => [BigInt(idx), val]);
    this.#tree.insertMany(leaves);
  }

  public commitment() {
    return this.#tree.root;
  }

  public prove(value: Value) {
    return this.#tree.generateProof(this.#tree.indexOf(value));
  }

  public verify(proof: MerkleProof) {
    return this.#tree.verifyProof(proof);
  }

  [Symbol.iterator](): IterableIterator<Value> {
    return this.#tree.leaves.values();
  }

  public equals(other: POD2Array) {
    return this.commitment() === other.commitment();
  }
}
