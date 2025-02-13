import { sha256 } from "js-sha256";
import { POD2Dictionary, POD2Set } from "../containers/containers.js";
import {
  derivePublicKey,
  packPublicKey,
  packSignature,
  signMessage,
  unpackPublicKey,
  unpackSignature,
  verifySignature,
} from "@zk-kit/eddsa-poseidon";
import { leBigIntToBuffer, leBufferToBigInt } from "@zk-kit/utils";
import { generateKeyPair } from "../utils/test.js";
import { Buffer } from "buffer";

type PODEntryMap = Map<bigint, bigint>;

// const SIGNER = BigInt("0x" + sha256("_signer"));
// const TYPE = BigInt("0x" + sha256("_type"));

export function sign(entries: PODEntryMap, privateKey: string) {
  const publicKey = derivePublicKey(Buffer.from(privateKey, "hex"));
  const publicKeyHex = leBigIntToBuffer(packPublicKey(publicKey)).toString(
    "hex"
  );

  // TODO consider inserting signer public key and type entry here

  const dict = new POD2Dictionary(entries);
  const root = dict.commitment();
  const signedMessage = signMessage(Buffer.from(privateKey, "hex"), root);
  const signature = packSignature(signedMessage);
  const signatureHex = signature.toString("hex");

  return { entries, signature: signatureHex, signer: publicKeyHex, id: root };
}

export function verify(podRoot: bigint, signature: string, publicKey: string) {
  const publicKeyBuffer = Buffer.from(publicKey, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");
  const unpackedSignature = unpackSignature(signatureBuffer);
  const unpackedPublicKey = unpackPublicKey(leBufferToBigInt(publicKeyBuffer));
  return verifySignature(podRoot, unpackedSignature, unpackedPublicKey);
}

if (import.meta.vitest) {
  const { test, expect, describe } = import.meta.vitest;

  const stringToBigInt = (str: string) => BigInt("0x" + sha256(str));

  describe("sign", () => {
    test("sign", () => {
      const { privateKey, publicKey } = generateKeyPair();
      const set = new POD2Set([1n, 2n, 3n]);
      const { entries, signature } = sign(
        new Map([
          [stringToBigInt("a"), 1n],
          [stringToBigInt("b"), 2n],
          [stringToBigInt("c"), set.commitment()],
        ]),
        privateKey
      );
      expect(entries).toEqual({
        a: 1n,
        b: 2n,
        c: set.commitment(),
        _signer: publicKey,
        _type: 1n,
      });
    });
  });
}
