import { sign } from "../frontends/eddsa_signed.js";
import { MainPodBuilder } from "../frontends/groth16_main.js";
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

  // console.dir(mainPod, { depth: null });

  // mainPod.print();

  const mainPod = mainPodBuilder.prove();
  console.log(mainPod.verify());
  console.log(await mainPod.prove());
}

if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest;

  test("zuKycExample", async () => {
    await zuKycExample();
  });
}
