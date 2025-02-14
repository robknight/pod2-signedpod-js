import { describe, bench } from "vitest";
import { sign, type Entries } from "../../src/frontends/eddsa_signed.js";
import { generateKeyPair } from "../../src/utils/test.js";

describe("eddsa-sign", () => {
  const { privateKey } = generateKeyPair();
  bench("sign", () => {
    sign(
      {
        foo: "foo",
        bar: "bar",
        baz: "baz",
        quux: ["abc", "def", "ghi"],
        meep: {
          lorem: "ipsum",
          dolor: "sit amet",
          consectetur: "adipiscing elit",
          sit: {
            amet: "consectetur",
            adipiscing: "elit",
            lol: ["hi", "there"],
          },
          xxx: 1337n,
        },
        urgh: new Set([BigInt("0xdeadbeef"), 0n, "baz", ["hi", "there"]]),
      } satisfies Entries,
      privateKey
    );
  }, { iterations: 100 });
});
