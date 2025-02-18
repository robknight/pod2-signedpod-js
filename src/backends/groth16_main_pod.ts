import type { MainPodInputs } from "../frontends/groth16_main.js";
import type { Params } from "../frontends/shared.js";
import { NoneSignedPod } from "./none_signed_pod.js";
import { BackendEdDSASignedPod } from "./eddsa_signed_pod.js";
import type { BackendSignedPod } from "./pods.js";
import {
  MiddlewareAnchoredKey,
  MiddlewareOperation,
  MiddlewareStatement,
  NativeOperation,
  type MiddlewareOperationArg,
  type MiddlewareStatementArg
} from "../middleware/statements.js";
import { toBackendValue } from "../middleware/conversion.js";
import {
  type CircuitSignals,
  groth16,
  type Groth16Proof,
  type PublicSignals
} from "snarkjs";

export const SELF = 1n;

class BackendOperation {
  nativeOperation: keyof typeof NativeOperation;
  args: BackendOperationArg[];

  constructor(
    nativeOperation: keyof typeof NativeOperation,
    args: BackendOperationArg[]
  ) {
    this.nativeOperation = nativeOperation;
    this.args = args;
  }

  public deref(statements: MiddlewareStatement[]): MiddlewareOperation {
    const args = this.args.map((arg) => {
      if (arg === 0n) {
        return "None";
      }
      // This is a rather crude way to use a bigint as an index
      return statements[parseInt(arg.toString())]!;
    });
    return new MiddlewareOperation(this.nativeOperation, args);
  }

  public code(): bigint {
    return BigInt(NativeOperation[this.nativeOperation]);
  }
}

type BackendOperationArg = 0n | bigint;

// export class Groth16MainPod {
//   params: Params;
//   id: bigint;
//   inputSignedPods: BackendSignedPod[];
//   // inputMainPods: BackendMainPod[];
//   statements: Middleware.Statement[];
//   publicStatements: Middleware.Statement[];
//   operations: BackendOperation[];

//   public constructor(
//     params: Params,
//     id: bigint,
//     inputSignedPods: BackendSignedPod[],
//     publicStatements: Middleware.Statement[],
//     operations: BackendOperation[],
//     statements: Middleware.Statement[]
//   ) {
//     this.params = params;
//     this.id = id;
//     this.inputSignedPods = inputSignedPods;
//     this.statements = statements;
//     this.publicStatements = publicStatements;
//     this.operations = operations;
//   }
// }

function fillPad<T>(arr: T[], length: number, fill: T): void {
  if (arr.length > length) {
    throw new Error(`Length ${arr.length} exceeds limit of ${length}!`);
  }
  for (let i = arr.length; i < length; i++) {
    arr.push(fill);
  }
}

export class Groth16MainPod {
  params: Params;
  id: bigint;
  inputSignedPods: BackendSignedPod[];
  statements: MiddlewareStatement[];
  publicStatements: MiddlewareStatement[];
  operations: BackendOperation[];

  public constructor(params: Params, inputs: MainPodInputs) {
    this.params = params;
    // validate inputs against params
    const statements = this.layoutStatements(params, inputs);
    let operations = this.processPrivateStatementsOperations(
      statements,
      inputs.operations
    );
    operations = this.processPublicStatementsOperations(statements, operations);
    const inputSignedPods = inputs.signedPods.map((pod) =>
      BackendEdDSASignedPod.fromFrontend(pod)
    );

    const publicStatements = statements.slice(
      statements.length - this.params.max_public_statements - 1
    );

    this.id = 1337n; // TODO: generate id from hash of statements
    this.inputSignedPods = inputSignedPods;
    this.statements = statements;
    this.publicStatements = publicStatements;
    this.operations = operations;
  }

  private offsetInputSignedPods(): number {
    return 0;
  }

  private offsetInputMainPods(): number {
    return (
      this.params.max_input_signed_pods * this.params.max_signed_pod_values
    );
  }

  private offsetInputStatements(): number {
    return (
      this.offsetInputMainPods() +
      this.params.max_input_main_pods * this.params.max_public_statements
    );
  }

  private offsetPublicStatements(): number {
    return (
      this.offsetInputStatements() +
      this.params.max_statements -
      this.params.max_public_statements
    );
  }

  private noneStatement(): MiddlewareStatement {
    return new MiddlewareStatement(
      "None",
      Array<MiddlewareStatementArg>(this.params.max_statement_args).fill("None")
    );
  }

  private noneOperation(): MiddlewareOperation {
    return new MiddlewareOperation(
      "None",
      Array<MiddlewareOperationArg>(this.params.max_operation_args).fill("None")
    );
  }

  private padStatementArgs(args: MiddlewareStatementArg[]): void {
    if (args.length >= this.params.max_statement_args) {
      return;
    }
    for (let i = args.length; i < this.params.max_statement_args; i++) {
      args.push("None");
    }
  }

  private padOperationArgs(args: MiddlewareOperationArg[]): void {
    if (args.length >= this.params.max_operation_args) {
      return;
    }
    for (let i = args.length; i < this.params.max_operation_args; i++) {
      args.push("None");
    }
  }

  private layoutStatements(
    params: Params,
    inputs: MainPodInputs
  ): MiddlewareStatement[] {
    const statements: MiddlewareStatement[] = [];

    const nonePod = new NoneSignedPod();

    // Handle Signed Pod inputs

    for (let i = 0; i < params.max_input_signed_pods; i++) {
      const inputPod = inputs.signedPods[i];
      const pod = inputPod
        ? BackendEdDSASignedPod.fromFrontend(inputPod)
        : nonePod;
      const podStatements = pod.publicStatements();
      if (podStatements.length > params.max_signed_pod_values) {
        throw new Error("Pod statements exceed max_signed_pod_values");
      }
      for (let j = 0; j < params.max_signed_pod_values; j++) {
        const statement = podStatements[j]
          ? podStatements[j]!.clone()
          : this.noneStatement();
        this.padStatementArgs(statement.args);
        statements.push(statement);
      }
    }

    // No Main Pod inputs, since we can't do recursive proofs

    // Handle statements
    const maxPrivateStatements =
      params.max_statements - params.max_public_statements;
    if (inputs.statements.length > maxPrivateStatements) {
      throw new Error("Statements exceed max_statements");
    }
    // input statements
    for (let i = 0; i < maxPrivateStatements; i++) {
      const statement = inputs.statements[i]
        ? inputs.statements[i]!.clone()
        : this.noneStatement();
      this.padStatementArgs(statement.args);
      statements.push(statement);
    }

    // public statements
    if (inputs.publicStatements.length > params.max_public_statements) {
      throw new Error("Public statements exceed max_public_statements");
    }
    statements.push(
      new MiddlewareStatement("ValueOf", [
        new MiddlewareAnchoredKey(SELF, toBackendValue("_type"))
      ])
    );

    for (let i = 0; i < params.max_public_statements; i++) {
      const statement = inputs.publicStatements[i]
        ? inputs.publicStatements[i]!.clone()
        : this.noneStatement();
      this.padStatementArgs(statement.args);
      statements.push(statement);
    }
    return statements;
  }

  private findOperationArg(
    statements: MiddlewareStatement[],
    arg: MiddlewareOperationArg
  ): BackendOperationArg {
    if (arg === "None") {
      return 0n;
    }
    if (arg instanceof MiddlewareAnchoredKey) {
      const statementIndex = statements.findIndex((s) =>
        s.args.some(
          (a) =>
            a instanceof MiddlewareAnchoredKey &&
            a.hashedKey === arg.hashedKey &&
            a.podId === arg.podId
        )
      );
      if (statementIndex === -1) {
        throw new Error("AnchoredKey not found in statements");
      }
      return BigInt(statementIndex);
    }
    throw new Error("Invalid operation arg");
  }

  private processPrivateStatementsOperations(
    statements: MiddlewareStatement[],
    inputOperations: MiddlewareOperation[]
  ): BackendOperation[] {
    const noneOperation = this.noneOperation();
    const operations: BackendOperation[] = [];
    const maxPrivateStatements =
      this.params.max_statements - this.params.max_public_statements;
    for (let i = 0; i < maxPrivateStatements; i++) {
      const operation = inputOperations[i] ?? noneOperation;
      const opArgs = operation.args;
      this.padOperationArgs(opArgs);
      const args = new Array<BackendOperationArg>();
      for (const arg of opArgs) {
        args.push(this.findOperationArg(statements, arg));
      }
      operations.push(new BackendOperation(operation.nativeOperation, args));
    }
    return operations;
  }

  private processPublicStatementsOperations(
    statements: MiddlewareStatement[],
    operations: BackendOperation[]
  ): BackendOperation[] {
    const offsetPublicStatements =
      statements.length - this.params.max_public_statements;
    //operations.push(new BackendOperation("NewEntry", []));

    for (let i = 0; i < this.params.max_public_statements - 1; i++) {
      const st = statements[offsetPublicStatements + i + 1]!;
      let op: BackendOperation;
      if (st.isNone()) {
        op = new BackendOperation("None", []);
      } else {
        op = new BackendOperation("CopyStatement", [
          this.findOperationArg(statements, st)
        ]);
        fillPad(op.args, this.params.max_operation_args, 0n);
        operations.push(op);
      }
    }

    return operations;
  }

  // For debugging purposes, remove later
  public logStatements(): void {
    const totalStatements = this.statements.length;
    const inputStatementOffset = this.offsetInputStatements();
    const publicStatementOffset = this.offsetPublicStatements();
    for (const [idx, statement] of this.statements.entries()) {
      if (idx === inputStatementOffset) {
        console.log("input statements");
      } else if (idx === publicStatementOffset) {
        console.log("public statements");
      }
      console.log(`${idx}: ${statement.nativeStatement}`);
    }
  }

  public verify(): boolean {
    const inputStatementOffset = this.offsetInputStatements();
    const inputStatements = this.statements.slice(inputStatementOffset);

    const idsMatch = true; // TODO check if ids match

    const hasTypeStatement = this.publicStatements.some(
      (s) =>
        s.nativeStatement === "ValueOf" &&
        s.args.length > 0 &&
        s.args[0] instanceof MiddlewareAnchoredKey &&
        s.args[0].podId === SELF &&
        s.args[0].hashedKey === toBackendValue("_type")
    );

    const maxPrivStatements =
      this.params.max_statements - this.params.max_public_statements;

    const keyIdPairs = inputStatements
      .map((statement, idx) => ({
        // The Rust code does this thing where it checks if the statement is
        // private, but then doesn't seem to do anything with that information?
        // Copied here for the sake of fidelity but I'm fairly sure it can be
        // removed.
        isPrivate: idx < maxPrivStatements,
        statement
      }))
      .filter(({ statement }) => statement.nativeStatement === "ValueOf")
      .flatMap(({ isPrivate, statement }) =>
        statement.args[0] instanceof MiddlewareAnchoredKey
          ? [
              {
                isPrivate,
                hashedKey: statement.args[0].hashedKey,
                podId: statement.args[0].podId
              }
            ]
          : []
      );

    const valueOfsAreUnique = !keyIdPairs.some((kp, index) =>
      keyIdPairs
        .slice(index + 1)
        .some((kp2) => kp.hashedKey === kp2.hashedKey && kp.podId === kp2.podId)
    );

    const statementCheck = inputStatements.every((statement, idx) => {
      const operation = this.operations[idx]!;
      return operation
        .deref(this.statements.slice(inputStatementOffset + idx))
        .check(statement);
    });

    return idsMatch && hasTypeStatement && valueOfsAreUnique && statementCheck;
  }

  private toCircuitSignals(): CircuitSignals {
    const signals: CircuitSignals = {};

    // We're going to need signals for:
    // - inputRoots
    // - inputHashedKeys
    // - inputValues
    // - inputProofSiblings
    // - inputProofIndices
    // - inputProofDepths
    // - operationCodes
    // - operationArgs

    const MAX_MERKLE_DEPTH = 5;

    signals.inputRoots = this.inputSignedPods.map((pod) => pod.id());
    signals.inputHashedKeys = this.inputSignedPods.flatMap((pod) => {
      const keys = Array.from(pod.kvs().keys());
      fillPad(keys, this.params.max_signed_pod_values, keys[0]);
      return keys;
    });
    signals.inputValues = this.inputSignedPods.flatMap((pod) => {
      const values = Array.from(pod.kvs().values());
      fillPad(values, this.params.max_signed_pod_values, values[0]);
      return values;
    });
    const proofs = this.inputSignedPods.flatMap((pod) => {
      const keys = Array.from(pod.kvs().keys());
      fillPad(keys, this.params.max_signed_pod_values, keys[0]);
      return keys.map((key) => pod.proof(key));
    });
    signals.inputProofSiblings = proofs.map((proof) => {
      const siblings = structuredClone(proof.siblings);
      fillPad(siblings, MAX_MERKLE_DEPTH, 0n);
      return siblings;
    });
    signals.inputProofIndices = proofs.map((proof) => proof.index);
    signals.inputProofDepths = proofs.map((proof) => proof.siblings.length);
    console.log(this.operations);
    signals.operationCodes = this.operations.map((op) => op.code());
    const MAX_OPERATIONS = 10; // TODO get from params somehow
    fillPad(signals.operationCodes, MAX_OPERATIONS, 0n);
    signals.operationArgs = this.operations.map((op) => {
      const args = structuredClone(op.args);
      fillPad(args, this.params.max_operation_args, 0n);
      return args;
    });

    console.dir(signals, { depth: null });
    console.log(signals.operationCodes.length);
    console.log(signals.operationArgs.length);

    return signals;
  }

  public async prove(): Promise<{
    proof: Groth16Proof;
    publicSignals: PublicSignals;
  }> {
    const signals = this.toCircuitSignals();
    // TODO better management of circuit assets
    const circuitPath = import.meta.dirname + "/../../build/groth16_pod/";
    const proof = await groth16.fullProve(
      signals,
      circuitPath + "groth16_pod_js/groth16_pod.wasm",
      circuitPath + "groth16_pkey.zkey"
    );
    return proof;
  }

  // TODO verify proof by reconstructing expected public signals from statements
}
