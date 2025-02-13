import { derivePublicKey, packPublicKey } from "@zk-kit/eddsa-poseidon";
import { leBigIntToBuffer } from "@zk-kit/utils";
import { uint8ArrayToHex } from "uint8array-extras";
import { getRandomValues } from "uncrypto";

export function generateKeyPair(): { privateKey: string; publicKey: string } {
  const privateKey = getRandomValues(new Uint8Array(32));
  const publicKey = derivePublicKey(privateKey);
  return {
    privateKey: uint8ArrayToHex(privateKey),
    publicKey: uint8ArrayToHex(leBigIntToBuffer(packPublicKey(publicKey))),
  };
}