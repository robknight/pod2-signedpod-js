import {
  containerInterning,
  toBackendValue,
} from "../middleware/conversion.js";
import {
  sign as signBackend,
  verify as verifyBackend,
} from "../backends/eddsa_signed_pod.js";
import { generateKeyPair } from "../utils/test.js";
import { deepFreeze } from "deep-freeze-es6";
import { derivePublicKey, packPublicKey } from "@zk-kit/eddsa-poseidon";
import { leBigIntToBuffer } from "@zk-kit/utils";
import type { Evaluate } from "../utils/types.js";

export type Scalar = string | bigint;
export type Recursive<T> =
  | T
  | Set<Recursive<T>>
  | Recursive<T>[]
  | { [key: string]: Recursive<T> };

export type EntryValue = Recursive<Scalar>;
export type ContainerValue = Exclude<EntryValue, Scalar>;

export interface Entries {
  [key: string]: EntryValue;
}

export interface Pod<E extends Entries> {
  id: bigint;
  entries: E;
  signature: string;
  signer: string;
}

interface EdDSAPodData<E extends Entries> {
  readonly id: bigint;
  readonly entries: E;
  readonly signature: string;
  readonly signer: string;
}

class EdDSAPod<E extends Entries> implements EdDSAPodData<E> {
  public readonly id: bigint;
  public readonly entries: E;
  public readonly signature: string;
  public readonly signer: string;

  constructor(id: bigint, entries: E, signature: string, signer: string) {
    this.id = id;
    this.entries = entries;
    this.signature = signature;
    this.signer = signer;
    deepFreeze(this);
  }

  public static fromData<E extends Entries>(
    data: EdDSAPodData<E>
  ): EdDSAPod<E> {
    return new EdDSAPod(data.id, data.entries, data.signature, data.signer);
  }
}

type WithSigner<E extends Entries> = Evaluate<E & { _signer: string }>;

export function sign<E extends Entries>(
  entries: E,
  privateKey: string
): EdDSAPodData<WithSigner<E>> {
  const publicKey = derivePublicKey(Buffer.from(privateKey, "hex"));
  const publicKeyHex = leBigIntToBuffer(packPublicKey(publicKey)).toString(
    "hex"
  );
  const clonedEntries = structuredClone(entries) as unknown as WithSigner<E>;
  clonedEntries._signer = publicKeyHex;
  deepFreeze(clonedEntries);

  const entriesToSign = new Map(
    Object.entries(clonedEntries).map(([key, value]) => [
      toBackendValue(key),
      toBackendValue(value),
    ])
  );

  const { signature, signer, id } = signBackend(entriesToSign, privateKey);

  return {
    signature,
    signer,
    id,
    entries: clonedEntries,
  };
}

export function verify(pod: EdDSAPodData<Entries>): boolean {
  const rootHash = toBackendValue(pod.entries);
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
    const { privateKey, publicKey } = generateKeyPair();

    test("foo", () => {
      const pod = sign(
        {
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
        } satisfies Entries,
        privateKey
      );

      const { entries } = pod;

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
      const entries = {
        foo: "foo",
        bar: "bar",
        baz: "baz",
      };

      const pod = sign(entries, privateKey);
      expect(pod.signature).toBeDefined();
      expect(pod.entries).toEqual({
        foo: "foo",
        bar: "bar",
        baz: "baz",
        _signer: publicKey,
      });

      const rootHash = toBackendValue(pod.entries, true);
      expect(rootHash).toBeDefined();

      expect(verify(pod)).toBe(true);
    });
  });
}
