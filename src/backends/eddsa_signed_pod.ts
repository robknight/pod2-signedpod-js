import { POD2Dictionary, POD2Set } from "../middleware/containers.js";
import {
  derivePublicKey,
  packPublicKey,
  packSignature,
  signMessage,
  verifySignature,
  type Signature
} from "@zk-kit/eddsa-poseidon";
import { leBigIntToBuffer } from "@zk-kit/utils";
import { generateKeyPair } from "../utils/test.js";
import { Buffer } from "buffer";
import { hashString, type MiddlewareValue } from "../middleware/shared.js";
import type { BackendSignedPod } from "./pods.js";
import {
  MiddlewareAnchoredKey,
  MiddlewareStatement
} from "../middleware/statements.js";
import type { Point } from "@zk-kit/baby-jubjub";
import type { EdDSAPodData, Entries } from "../frontends/eddsa_signed.js";
import { getPod } from "../middleware/pods.js";
import type { LeanIMTMerkleProof } from "@zk-kit/lean-imt";

type EdDSAPodSignature = Signature<bigint>;
type EdDSAPodPublicKey = Point<bigint>;

type PODEntryMap = Map<bigint, bigint>;

interface EdDSAPodSignResult {
  signature: EdDSAPodSignature;
  signer: EdDSAPodPublicKey;
  id: bigint;
  dict: POD2Dictionary;
}

export class BackendEdDSASignedPod implements BackendSignedPod {
  #dict: POD2Dictionary;
  #id: bigint;
  #signature: Signature<bigint>;
  #signer: Point<bigint>;

  public constructor(
    dict: POD2Dictionary,
    signature: EdDSAPodSignature,
    signer: EdDSAPodPublicKey
  ) {
    this.#dict = dict;
    this.#id = dict.commitment();
    this.#signature = signature;
    this.#signer = signer;
  }

  public verify(): boolean {
    return verify(this.#id, this.#signature, this.#signer);
  }

  public id(): bigint {
    return this.#id;
  }

  public get signature(): EdDSAPodSignature {
    return this.#signature;
  }

  public get signer(): EdDSAPodPublicKey {
    return this.#signer;
  }

  public signatureHex(): string {
    const signatureBuffer = packSignature(this.#signature);
    return signatureBuffer.toString("hex");
  }

  public signerHex(): string {
    const signerBuffer = packPublicKey(this.#signer);
    return leBigIntToBuffer(signerBuffer).toString("hex");
  }

  public kvs(): Map<MiddlewareValue, MiddlewareValue> {
    // Since a dict is iterable, we can turn it into a map.
    return new Map(this.#dict);
  }

  public proof(key: MiddlewareValue): LeanIMTMerkleProof {
    return this.#dict.prove(key);
  }

  public publicStatements(): MiddlewareStatement[] {
    const statements: MiddlewareStatement[] = [];
    for (const [k, v] of this.#dict) {
      statements.push(
        new MiddlewareStatement("ValueOf", [
          new MiddlewareAnchoredKey(this.#id, k),
          v
        ])
      );
    }

    return statements;
  }

  static fromFrontend(pod: EdDSAPodData<Entries>): BackendEdDSASignedPod {
    const backendPod = getPod(pod);
    if (!backendPod) {
      throw new Error("Pod not found");
    }
    return backendPod as BackendEdDSASignedPod;
  }
}

export function backendEdDSASign(
  entries: PODEntryMap,
  privateKey: string
): BackendEdDSASignedPod {
  const dict = new POD2Dictionary(entries);
  const root = dict.commitment();

  // TODO we could do some interning here, if we already have an instance of
  // this Pod in memory then we could return it from a cache. It doesn't save
  // any work but might save some memory.

  const signedMessage = signMessage(Buffer.from(privateKey, "hex"), root);

  const publicKey = derivePublicKey(Buffer.from(privateKey, "hex"));

  return new BackendEdDSASignedPod(dict, signedMessage, publicKey);
}

export function verify(
  id: bigint,
  signature: EdDSAPodSignature,
  publicKey: EdDSAPodPublicKey
): boolean {
  return verifySignature(id, signature, publicKey);
}

if (import.meta.vitest) {
  const { test, expect, describe } = import.meta.vitest;

  const stringToBigInt = (str: string) => BigInt("0x" + hashString(str));

  describe("sign", () => {
    test("sign", () => {
      const { privateKey, publicKey } = generateKeyPair();
      const set = new POD2Set([1n, 2n, 3n]);
      const pod = backendEdDSASign(
        new Map([
          [stringToBigInt("a"), 1n],
          [stringToBigInt("b"), 2n],
          [stringToBigInt("c"), set.commitment()]
        ]),
        privateKey
      );

      expect(pod.verify()).toBe(true);
    });
  });
}
