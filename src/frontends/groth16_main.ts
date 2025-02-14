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
  POD_CLASS_SIGNED
} from "./shared.js";

interface Groth16MainPod {
  input_signed_pods: Record<string, EdDSAPodData<Entries>>;
  operations: Operation[];
  input_statements: Statement[];
  public_statements: Statement[];
  all_statements: Statement[]; // why?
}

class MainPodBuilder {
  #newEntryCount = 0;
  #signedPods: EdDSAPodData<Entries>[] = [];
  #statements: Statement[] = [];
  #publicStatements: Statement[] = [];
  #operations: Operation[] = [];

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

  public insert(st: Statement, op: Operation) {}

  public addSignedPod(pod: EdDSAPodData<Entries>) {
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

  public print() {
    console.dir(this.#statements, { depth: null });
    console.dir(this.#operations, { depth: null });
    console.dir(this.#signedPods, { depth: null });
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
    });
  });
}
