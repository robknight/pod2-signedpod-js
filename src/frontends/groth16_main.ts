import {
  sign,
  type EdDSAPodData,
  type Entries,
  type EntryValue
} from "./eddsa_signed.js";
import { generateKeyPair } from "../utils/test.js";
import {
  Operation,
  Statement,
  type OperationArg,
  type StatementArg,
  AnchoredKey,
  Entry,
  Origin,
  POD_CLASS_SIGNED,
  type Params
} from "./shared.js";
import { zip } from "../utils/zip.js";
import { Groth16MainPod } from "../backends/groth16_main_pod.js";
import {
  MiddlewareStatement,
  MiddlewareAnchoredKey,
  MiddlewareOperation,
  type MiddlewareStatementArg,
  type MiddlewareOperationArg
} from "../middleware/statements.js";
import { toBackendValue } from "../middleware/conversion.js";

// interface Groth16MainPod {
//   input_signed_pods: Record<string, EdDSAPodData<Entries>>;
//   operations: Operation[];
//   input_statements: Statement[];
//   public_statements: Statement[];
//   all_statements: Statement[]; // why?
// }

const DEFAULT_PARAMS: Params = {
  max_input_signed_pods: 2,
  max_input_main_pods: 3,
  // Meaning additional statements beyond the input statements from signed Pods:
  max_statements: 20,
  max_signed_pod_values: 6,
  max_public_statements: 10,
  max_statement_args: 5,
  max_operation_args: 5
};

export class MainPodBuilder {
  #newEntryCount = 0;
  #signedPods: EdDSAPodData<Entries>[] = [];
  #statements: Statement[] = [];
  #publicStatements: Statement[] = [];
  #operations: Operation[] = [];

  public get statements(): Statement[] {
    return this.#statements;
  }

  public get operations(): Operation[] {
    return this.#operations;
  }

  public get publicStatements(): Statement[] {
    return this.#publicStatements;
  }

  #op_arg_entries(isPublic: boolean, args: OperationArg[]): StatementArg[] {
    const statementArgs: StatementArg[] = [];
    for (const [index, arg] of args.entries()) {
      if (arg instanceof AnchoredKey) {
        statementArgs.push(arg);
      } else if (arg instanceof Statement) {
        throw new Error("Can't convert Statement to StatementArg");
      } else if (arg instanceof Entry) {
        statementArgs.push(
          new AnchoredKey(
            // We want the origin to be (MainPod, SELF) but we don't have the constants yet
            new Origin(/* TODO pod class? */ 0, /* TODO pod id? */ 1n),
            arg.name
          )
        );
        statementArgs.push(arg.value);
      } else {
        // Literal value
        arg satisfies EntryValue;

        const key = `c${this.#newEntryCount}`;
        this.#newEntryCount++;
        const valueOfStmt = this.addOperation(
          isPublic,
          new Operation("NewEntry", [new Entry(key, arg)])
        );
        args[index] = new AnchoredKey(
          // We want the origin to be (MainPod, SELF) but we don't have the constants yet
          new Origin(/* TODO pod class? */ 0, /* TODO pod id? */ 1n),
          key
        );
        statementArgs.push(valueOfStmt.args[0]!);
      }
    }
    return statementArgs;
  }

  public insert(st: Statement, op: Operation): void {
    this.#statements.push(st);
    this.#operations.push(op);
  }

  public addSignedPod(pod: EdDSAPodData<Entries>): void {
    this.#signedPods.push(pod);
  }

  public addPublicOperation(op: Operation): Statement {
    return this.addOperation(true, op);
  }

  public addOperation(isPublic: boolean, op: Operation): Statement {
    const { nativeOperation, args } = op;

    let statement: Statement;

    switch (nativeOperation) {
      case "None":
        statement = { nativeStatement: "None", args: [] };
        break;
      case "NewEntry":
        statement = {
          nativeStatement: "ValueOf",
          args: this.#op_arg_entries(isPublic, args)
        };
        break;
      case "EqualFromEntries":
        statement = {
          nativeStatement: "Equal",
          args: this.#op_arg_entries(isPublic, args)
        };
        break;
      default:
        throw new Error(`Unknown operation: ${nativeOperation}`);
    }

    this.#operations.push(op);
    this.#statements.push(statement);

    if (isPublic) {
      this.#publicStatements.push(statement);
    }

    return statement;
  }

  public prove(): Groth16MainPod {
    const compiler = new MainPodCompiler(DEFAULT_PARAMS);

    const { statements, operations, publicStatements } = compiler.compile({
      statements: this.#statements,
      operations: this.#operations,
      publicStatements: this.#publicStatements
    });

    const inputs: MainPodInputs = {
      statements,
      operations,
      publicStatements,
      signedPods: this.#signedPods
    };

    const pod = new Groth16MainPod(DEFAULT_PARAMS, inputs);
    return pod;
  }

  public print(): void {
    console.dir(this.#statements, { depth: null });
    console.dir(this.#operations, { depth: null });
    console.dir(this.#signedPods, { depth: null });
  }
}

interface MainPodCompilerInputs {
  statements: Statement[];
  operations: Operation[];
  publicStatements: Statement[];
}

interface MainPodCompilerOutputs {
  statements: MiddlewareStatement[];
  operations: MiddlewareOperation[];
  publicStatements: MiddlewareStatement[];
}

export interface MainPodInputs {
  statements: MiddlewareStatement[];
  operations: MiddlewareOperation[];
  publicStatements: MiddlewareStatement[];
  signedPods: EdDSAPodData<Entries>[];
}

class MainPodCompiler {
  #statements: MiddlewareStatement[] = [];
  #operations: MiddlewareOperation[] = [];
  params: Params;

  constructor(params: Params) {
    this.params = params;
  }

  public compile(inputs: MainPodCompilerInputs): MainPodCompilerOutputs {
    const { statements, operations, publicStatements } = inputs;

    for (const [st, op] of zip(statements, operations)) {
      this.compileStatementAndOperation(st, op);

      if (this.#statements.length > this.params.max_statements) {
        throw new Error("Max statements reached");
      }
    }

    const outputPublicStatements = publicStatements.map(
      this.compileStatement.bind(this)
    );

    return {
      statements: this.#statements,
      operations: this.#operations,
      publicStatements: outputPublicStatements
    };
  }

  private compileAnchoredKey(ak: AnchoredKey) {
    return new MiddlewareAnchoredKey(ak.origin.podId, toBackendValue(ak.key));
  }

  private compileStatement(st: Statement) {
    const statementArgs: MiddlewareStatementArg[] = [];

    for (const arg of st.args) {
      if (arg instanceof AnchoredKey) {
        statementArgs.push(this.compileAnchoredKey(arg));
      } else {
        statementArgs.push(toBackendValue(arg));
      }
      if (statementArgs.length > this.params.max_statement_args) {
        throw new Error("Max statement args reached");
      }
    }

    return new MiddlewareStatement(st.nativeStatement, statementArgs);
  }

  private compileOperationArg(arg: OperationArg): MiddlewareOperationArg {
    if (arg instanceof AnchoredKey) {
      return this.compileAnchoredKey(arg);
    } else if (arg instanceof Statement) {
      return this.compileStatement(arg);
    } else if (arg instanceof Entry) {
      return "None";
    } else {
      throw new Error("Unknown operation arg");
    }
  }

  private compileStatementAndOperation(st: Statement, op: Operation) {
    const statement = this.compileStatement(st);
    this.pushStatementAndOperation(
      statement,
      new MiddlewareOperation(
        op.nativeOperation,
        op.args.map(this.compileOperationArg.bind(this))
      )
    );
  }

  private pushStatementAndOperation(
    st: MiddlewareStatement,
    op: MiddlewareOperation
  ): void {
    this.#statements.push(st);
    this.#operations.push(op);
  }
}

if (import.meta.vitest) {
  const { describe, test, expect } = import.meta.vitest;

  describe("MainPodBuilder", () => {
    const { privateKey, publicKey } = generateKeyPair();

    test("addOperation", () => {
      const builder = new MainPodBuilder();
      const pod = sign({ a: 1n }, privateKey);
      builder.addSignedPod(pod);
      builder.addPublicOperation(
        new Operation("EqualFromEntries", [
          new AnchoredKey(new Origin(POD_CLASS_SIGNED, pod.id), "a"),
          1n
        ])
      );
      builder.print();

      const compiler = new MainPodCompiler(DEFAULT_PARAMS);

      const outputs = compiler.compile({
        statements: builder.statements,
        operations: builder.operations,
        publicStatements: builder.publicStatements
      });

      console.dir(outputs, { depth: null });
    });
  });
}
