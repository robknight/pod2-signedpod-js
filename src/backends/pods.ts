import type { LeanIMTMerkleProof } from "@zk-kit/lean-imt";
import type { MiddlewareValue } from "../middleware/shared.js";
import type { MiddlewareStatement } from "../middleware/statements.js";

export interface BackendSignedPod {
  verify(): boolean;
  id(): bigint;
  publicStatements(): MiddlewareStatement[];
  kvs(): Map<MiddlewareValue, MiddlewareValue>;
  proof(key: MiddlewareValue): LeanIMTMerkleProof;
}
