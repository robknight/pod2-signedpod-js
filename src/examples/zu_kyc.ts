import { sign } from "../frontends/eddsa_signed.js";
import { DEFAULT_PARAMS, MainPodBuilder } from "../frontends/groth16_main.js";
import {
  AnchoredKey,
  Operation,
  Origin,
  POD_CLASS_SIGNED
} from "../frontends/shared.js";
import { generateKeyPair } from "../utils/test.js";

async function zuKycExample() {
  const keypair = generateKeyPair();

  const govId = sign(
    {
      idNumber: "42424242424242",
      dateOfBirth: 1169909384n,
      socialSecurityNumber: "G2121210"
    },
    keypair.privateKey
  );

  const payStub = sign(
    {
      socialSecurityNumber: "G2121210",
      startDate: 1706367566n
    },
    keypair.privateKey
  );

  const mainPodBuilder = new MainPodBuilder();
  mainPodBuilder.addSignedPod(govId);
  mainPodBuilder.addSignedPod(payStub);
  mainPodBuilder.addPublicOperation(
    new Operation("EqualFromEntries", [
      new AnchoredKey(
        new Origin(POD_CLASS_SIGNED, govId.id),
        "socialSecurityNumber"
      ),
      new AnchoredKey(
        new Origin(POD_CLASS_SIGNED, payStub.id),
        "socialSecurityNumber"
      )
    ])
  );

  // I think I've modelled the "prover" trait incorrectly here.
  // What is the final act of the builder? build()?
  const mainPod = mainPodBuilder.prove();
  return mainPod.prove();
}

if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest;

  test("zuKycExample", async () => {
    const { proof, publicSignals } = await zuKycExample();
    // For ease of debugging, all statements are public
    const firstOperationStatementIndex =
      DEFAULT_PARAMS.max_input_signed_pods *
      DEFAULT_PARAMS.max_signed_pod_values;
    // We only have one statement, an Equal statement produced by our
    // EqualFromEntries operation.
    // The values are equal so this should be 1.
    expect(BigInt(publicSignals[firstOperationStatementIndex]!)).toBe(1n);
  });
}
