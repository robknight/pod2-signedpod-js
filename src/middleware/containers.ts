import { poseidon2 } from "poseidon-lite/poseidon2";
import * as imt from "@zk-kit/lean-imt";
import type { MiddlewareValue } from "./shared.js";
import type { Evaluate } from "../utils/types.js";

type MerkleProof = Evaluate<imt.LeanIMTMerkleProof<bigint>>;

function hashFunction(left: bigint, right: bigint): bigint {
  return poseidon2([left, right]);
}

export class POD2Dictionary {
  #tree: imt.LeanIMT<bigint>;

  public constructor(kv: Map<MiddlewareValue, MiddlewareValue>) {
    if (kv.size === 0) {
      throw new Error("POD2Dictionary cannot be empty");
    }
    this.#tree = new imt.LeanIMT<bigint>(hashFunction);
    this.#tree.insertMany(
      Array.from(kv.entries())
        .sort((a, b) => (a[0] > b[0] ? 1 : -1))
        .flat()
    );
  }

  public commitment(): bigint {
    return this.#tree.root;
  }

  public get(key: MiddlewareValue): bigint | undefined {
    const keyPos = this.#tree.indexOf(key);
    return this.#tree.leaves[keyPos + 1];
  }

  public prove(value: MiddlewareValue): MerkleProof {
    return this.#tree.generateProof(this.#tree.indexOf(value));
  }

  public verify(proof: MerkleProof): boolean {
    return this.#tree.verifyProof(proof);
  }

  [Symbol.iterator](): IterableIterator<[MiddlewareValue, MiddlewareValue]> {
    const leaves = this.#tree.leaves;
    return (function* () {
      for (let i = 0; i < leaves.length; i += 2) {
        yield [leaves[i]!, leaves[i + 1]!];
      }
    })();
  }

  public equals(other: POD2Dictionary): boolean {
    return this.commitment() === other.commitment();
  }
}

const EMPTY = 0n; // TODO ?? what should this be?

export class POD2Set {
  #tree: imt.LeanIMT<bigint>;

  public constructor(values: MiddlewareValue[]) {
    if (values.length === 0) {
      throw new Error("POD2Set cannot be empty");
    }
    this.#tree = new imt.LeanIMT<bigint>(hashFunction);
    const leaves = [];
    for (const value of values) {
      leaves.push(value, EMPTY);
    }
    this.#tree.insertMany(leaves.sort((a, b) => (a > b ? 1 : -1)));
  }

  public commitment(): bigint {
    return this.#tree.root;
  }

  public prove(value: MiddlewareValue): MerkleProof {
    return this.#tree.generateProof(this.#tree.indexOf(value));
  }

  public verify(proof: MerkleProof): boolean {
    return this.#tree.verifyProof(proof);
  }

  [Symbol.iterator](): IterableIterator<MiddlewareValue> {
    return this.#tree.leaves.values();
  }
}

export class POD2Array {
  #tree: imt.LeanIMT<bigint>;

  public constructor(values: MiddlewareValue[]) {
    if (values.length === 0) {
      // TODO perhaps empty arrays are allowed, in which case we need a special value
      throw new Error("POD2Array cannot be empty");
    }
    this.#tree = new imt.LeanIMT<bigint>(hashFunction);
    const leaves = values.flatMap((val, idx) => [BigInt(idx), val]);
    this.#tree.insertMany(leaves);
  }

  public commitment(): bigint {
    return this.#tree.root;
  }

  public prove(value: MiddlewareValue): MerkleProof {
    return this.#tree.generateProof(this.#tree.indexOf(value));
  }

  public verify(proof: MerkleProof): boolean {
    return this.#tree.verifyProof(proof);
  }

  [Symbol.iterator](): IterableIterator<MiddlewareValue> {
    return this.#tree.leaves.values();
  }

  public equals(other: POD2Array): boolean {
    return this.commitment() === other.commitment();
  }
}
