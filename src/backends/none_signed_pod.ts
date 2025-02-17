import type { MiddlewareValue } from "../middleware/shared.js";
import type { MiddlewareStatement } from "../middleware/statements.js";
import type { BackendSignedPod } from "./pods.js";

export class NoneSignedPod implements BackendSignedPod {
  public constructor() {}

  public verify(): boolean {
    return true;
  }

  public id(): bigint {
    return 0n;
  }

  public kvs(): Map<MiddlewareValue, MiddlewareValue> {
    return new Map();
  }

  public publicStatements(): MiddlewareStatement[] {
    return [];
  }
}
