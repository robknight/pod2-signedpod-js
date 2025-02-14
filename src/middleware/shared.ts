import { sha256 } from "js-sha256";

export type Value = bigint;

export function hashString(str: string) {
  return sha256(str);
}
