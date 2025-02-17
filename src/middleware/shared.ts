import { sha256 } from "js-sha256";

export type MiddlewareValue = bigint;

export function hashString(str: string): string {
  return sha256(str);
}
