import { SELF } from "../backends/groth16_main_pod.js";
import type { MiddlewareValue } from "./shared.js";
import deepEqual from "deep-equal";

export const NativeStatement = {
  None: 0,
  ValueOf: 1,
  Equal: 2,
  NotEqual: 3,
  Gt: 4,
  Lt: 5,
  Contains: 6,
  NotContains: 7,
  SumOf: 8,
  ProductOf: 9,
  MaxOf: 10
} as const;

export const NativeOperation = {
  None: 0,
  NewEntry: 1,
  CopyStatement: 2,
  EqualFromEntries: 3,
  NotEqualFromEntries: 4,
  GtFromEntries: 5,
  LtFromEntries: 6,
  TransitiveEqualFromStatements: 7,
  GtToNotEqual: 8,
  LtToNotEqual: 9,
  ContainsFromEntries: 10,
  NotContainsFromEntries: 11,
  RenameContainedBy: 12,
  SumOf: 13,
  ProductOf: 14,
  MaxOf: 15
} as const;

export class MiddlewareAnchoredKey {
  podId: bigint;
  hashedKey: bigint;

  constructor(podId: bigint, hashedKey: bigint) {
    this.podId = podId;
    this.hashedKey = hashedKey;
  }
}

export type MiddlewareStatementArg =
  | "None"
  | MiddlewareValue
  | MiddlewareAnchoredKey;

export class MiddlewareStatement {
  nativeStatement: keyof typeof NativeStatement;
  args: MiddlewareStatementArg[];

  constructor(
    nativeStatement: keyof typeof NativeStatement,
    args: MiddlewareStatementArg[]
  ) {
    this.nativeStatement = nativeStatement;
    this.args = args;
  }

  public isNone(): boolean {
    return this.nativeStatement === "None";
  }

  public code(): keyof typeof NativeStatement {
    return this.nativeStatement;
  }

  public toFields(): bigint[] {
    const fields: bigint[] = [];
    fields.push(BigInt(NativeStatement[this.nativeStatement]));
    for (const arg of this.args) {
      if (arg === "None") {
        fields.push(0n);
      } else if (typeof arg === "bigint") {
        fields.push(arg);
      } else {
        fields.push(arg.podId);
        fields.push(arg.hashedKey);
      }
    }
    return fields;
  }

  public clone(): MiddlewareStatement {
    return new MiddlewareStatement(this.nativeStatement, this.args);
  }

  public equals(other: MiddlewareStatement): boolean {
    return (
      this.nativeStatement === other.nativeStatement &&
      this.args.every((arg, index) => deepEqual(arg, other.args[index]))
    );
  }
}

export type MiddlewareOperationArg =
  | MiddlewareStatement
  | MiddlewareAnchoredKey
  | "None";

export class MiddlewareOperation {
  nativeOperation: keyof typeof NativeOperation;
  args: MiddlewareOperationArg[];

  constructor(
    nativeOperation: keyof typeof NativeOperation,
    args: MiddlewareOperationArg[]
  ) {
    this.nativeOperation = nativeOperation;
    this.args = args;
  }

  public check(outputStatement: MiddlewareStatement): boolean {
    switch (this.nativeOperation) {
      case "None":
        return outputStatement.isNone();
      case "NewEntry":
        return (
          outputStatement.code() === "ValueOf" &&
          outputStatement.args.length === 1 &&
          outputStatement.args[0] instanceof MiddlewareAnchoredKey &&
          outputStatement.args[0].podId === SELF
        );
      case "CopyStatement":
        return (
          this.args[0] instanceof MiddlewareStatement &&
          outputStatement.equals(this.args[0])
        );
      case "EqualFromEntries":
        const s1 =
          this.args[0] instanceof MiddlewareStatement
            ? this.args[0]
            : undefined;
        if (!s1) {
          throw new Error(
            "EqualFromEntries: first argument is not a Statement"
          );
        }

        const s2 =
          this.args[1] instanceof MiddlewareStatement
            ? this.args[1]
            : undefined;
        if (!s2) {
          throw new Error(
            "EqualFromEntries: second argument is not a Statement"
          );
        }

        if (!(s1.args[0] instanceof MiddlewareAnchoredKey)) {
          throw new Error(
            "EqualFromEntries: first argument is not an AnchoredKey"
          );
        }

        const { hashedKey: s1Key, podId: s1PodId } = s1.args[0];

        if (!(s2.args[0] instanceof MiddlewareAnchoredKey)) {
          throw new Error(
            "EqualFromEntries: second argument is not an AnchoredKey"
          );
        }

        const { hashedKey: s2Key, podId: s2PodId } = s2.args[0];

        const statementsEqual =
          s1.code() === "ValueOf" && s2.code() === "ValueOf" && s1Key === s2Key;

        return (
          statementsEqual &&
          outputStatement.code() === "Equal" &&
          outputStatement.args[0] instanceof MiddlewareAnchoredKey &&
          outputStatement.args[0].hashedKey === s1Key &&
          outputStatement.args[1] instanceof MiddlewareAnchoredKey &&
          outputStatement.args[1].hashedKey === s2Key
        );
      default:
        // TODO: Implement the rest of the operations
        return true;
    }
  }
}
