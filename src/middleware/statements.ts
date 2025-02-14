import type { Value } from "./shared.js";

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
  MaxOf: 10,
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
  MaxOf: 15,
} as const;

class AnchoredKey {
  podId: bigint;
  hashedKey: bigint;

  constructor(podId: bigint, hashedKey: bigint) {
    this.podId = podId;
    this.hashedKey = hashedKey;
  }
}

type StatementArg = "None" | Value | AnchoredKey;

class Statement {
  nativeStatement: keyof typeof NativeStatement; 
  args: StatementArg[];

  constructor(nativeStatement: keyof typeof NativeStatement, args: StatementArg[]) {
    this.nativeStatement = nativeStatement;
    this.args = args;
  }
}

type OperationArg = Statement | AnchoredKey | "None";

class Operation {
  nativeOperation: keyof typeof NativeOperation;
  args: OperationArg[];

  constructor(nativeOperation: keyof typeof NativeOperation, args: OperationArg[]) {
    this.nativeOperation = nativeOperation;
    this.args = args;
  }
}

