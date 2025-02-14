import type {
  NativeOperation,
  NativeStatement
} from "../middleware/statements.js";
import type { EntryValue } from "./eddsa_signed.js";

interface Params {
  max_input_signed_pods: number;
  max_statements: number;
  max_signed_pod_values: number;
  max_public_statements: number;
  max_statement_args: number;
  max_operation_args: number;
}

export type Value = EntryValue; // might need to rename this to "PodValue"

export const POD_CLASS_MAIN = 0;
export const POD_CLASS_SIGNED = 1;

export class Origin {
  podClass: number; // an enum goes here
  podId: bigint;

  constructor(podClass: number, podId: bigint) {
    this.podClass = podClass;
    this.podId = podId;
  }
}

export class AnchoredKey {
  origin: Origin;
  key: string;

  constructor(origin: Origin, key: string) {
    this.origin = origin;
    this.key = key;
  }
}

export type StatementArg = Value | AnchoredKey;

export class Statement {
  nativeStatement: keyof typeof NativeStatement; // some kind of enum
  args: StatementArg[];

  constructor(
    nativeStatement: keyof typeof NativeStatement,
    args: StatementArg[]
  ) {
    this.nativeStatement = nativeStatement;
    this.args = args;
  }
}

export class Entry {
  name: string; // ???
  value: EntryValue;

  constructor(name: string, value: EntryValue) {
    this.name = name;
    // TODO clone this? or freeze it? perhaps it's already frozen, and clone if not?
    this.value = value;
  }
}

// Not sure what Entry is here, maybe it's for comparison of both a key and value at the same time?
export type OperationArg =
  | Statement
  | AnchoredKey /* Key */
  | Value /* Literal */
  | Entry;

export class Operation {
  nativeOperation: keyof typeof NativeOperation; // some kind of enum

  // TODO we should be able to make these type-safe per operation
  args: OperationArg[];

  constructor(
    nativeOperation: keyof typeof NativeOperation,
    args: OperationArg[]
  ) {
    this.nativeOperation = nativeOperation;
    this.args = args;
  }
}
