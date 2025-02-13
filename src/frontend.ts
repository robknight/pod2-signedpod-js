import { containerInterning, toBackendValue } from "./conversion.js";
import { type Branded } from "./utils/brand.js";
import {
  sign as signBackend,
  verify as verifyBackend,
} from "./backends/eddsa_signed_pod.js";
import { generateKeyPair } from "./utils/test.js";

export type Scalar = string | bigint;
export type Recursive<T> =
  | T
  | Set<Recursive<T>>
  | Recursive<T>[]
  | { [key: string]: Recursive<T> };

export type Value = Recursive<Scalar>;
export type ContainerValue = Exclude<Value, Scalar>;

export interface Entries {
  [key: string]: Value;
}

export interface POD<E extends Entries> {
  id: bigint;
  entries: E;
  signature: string;
  signer: string;
}

type ParsedEntries<E extends Entries> = Branded<E, "ParsedEntries">;

const parsedEntriesCache = new WeakMap<Entries, ParsedEntries<Entries>>();

export function parseEntries<E extends Entries>(entries: E): ParsedEntries<E> {
  // TODO: check that entries are valid
  // TODO: deep freeze
  const cached = parsedEntriesCache.get(entries);
  if (cached) {
    return cached as ParsedEntries<E>;
  }
  const parsed = structuredClone(entries) as ParsedEntries<E>;
  parsedEntriesCache.set(entries, parsed);
  return parsed;
}

export function sign(
  entries: ParsedEntries<Entries>,
  privateKey: string
): POD<Entries> {
  const entriesToSign = new Map(
    Object.entries(entries).map(([key, value]) => [
      toBackendValue(key),
      toBackendValue(value),
    ])
  );

  const {
    signature,
    entries: signedEntries,
    signer,
    id,
  } = signBackend(entriesToSign, privateKey);

  return {
    signature,
    signer,
    id,
    entries
  };
}

export function verify(pod: POD<Entries>): boolean {
  const rootHash = toBackendValue(pod.entries, true);
  return verifyBackend(rootHash, pod.signature, pod.signer);
}

if (import.meta.vitest) {
  const { test, describe, expect } = import.meta.vitest;

  function getCommitment(value: ContainerValue): bigint {
    if (containerInterning.has(value)) {
      return containerInterning.get(value)!.commitment();
    } else {
      return toBackendValue(value);
    }
  }

  describe("toBackendValue", () => {
    test("foo", () => {
      const entries = parseEntries({
        foo: "foo",
        bar: "bar",
        baz: "baz",
        quux: ["abc", "def", "ghi"],
        meep: {
          lorem: "ipsum",
          dolor: "sit amet",
          consectetur: "adipiscing elit",
          sit: {
            amet: "consectetur",
            adipiscing: "elit",
            lol: ["hi", "there"],
          },
          xxx: 1337n,
        },
        urgh: new Set([BigInt("0xdeadbeef"), 0n, "baz", ["hi", "there"]]),
      } satisfies Entries);

      const entriesContentID = toBackendValue(entries);
      expect(entriesContentID).toBeDefined();

      // Prove that entries.meep is in entries
      const objectDict = containerInterning.get(entries)!;
      const meepInEntriesProof = objectDict.prove(getCommitment(entries.meep));
      expect(objectDict.verify(meepInEntriesProof)).to.be.true;

      // Prove that "hi" is at entries.meep.sit.lol[0]
      const deeplyNestedArray = containerInterning.get(entries.meep.sit.lol)!;
      const deeplyNestedArrayProof = deeplyNestedArray.prove(
        toBackendValue("hi")
      );
      expect(deeplyNestedArray.verify(deeplyNestedArrayProof)).to.be.true;
    });

    test("sign", () => {
      const { privateKey, publicKey } = generateKeyPair();

      const entries = parseEntries({
        foo: "foo",
        bar: "bar",
        baz: "baz",
      } satisfies Entries);

      const pod = sign(entries, privateKey);
      expect(pod.signature).toBeDefined();
      expect(pod.entries).toEqual({
        foo: "foo",
        bar: "bar",
        baz: "baz",
      });

      const rootHash = toBackendValue(pod.entries, true);
      expect(rootHash).toBeDefined();

      expect(verify(pod)).toBe(true);
    });
  });
}
