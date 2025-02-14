import { POD2Set, POD2Array, POD2Dictionary } from "./containers.js";
import type { ContainerValue, EntryValue } from "../frontends/eddsa_signed.js";
import { hashString } from "./shared.js";

export const containerInterning = new WeakMap<
  ContainerValue,
  POD2Set | POD2Array | POD2Dictionary
>();

function toBackendSet(set: Set<EntryValue>): POD2Set {
  const values = Array.from(set).map((value) => toBackendValue(value));
  return new POD2Set(values);
}

function toBackendArray(array: EntryValue[]): POD2Array {
  const values = array.map((value) => toBackendValue(value));
  return new POD2Array(values);
}

function toBackendDictionary(dict: Record<string, EntryValue>): POD2Dictionary {
  const values = new Map(
    Object.entries(dict).map(([key, value]) => [
      toBackendValue(key),
      toBackendValue(value)
    ])
  );
  return new POD2Dictionary(values);
}

export function toBackendValue(value: EntryValue, skipCache = false): bigint {
  if (typeof value === "string") {
    return BigInt("0x" + hashString(value));
  }

  if (typeof value === "bigint") {
    return value;
  }

  if (!Object.isFrozen(value)) {
    throw new Error("Cannot convert mutable object to backend value");
  }

  if (!skipCache && containerInterning.has(value)) {
    return containerInterning.get(value)!.commitment();
  }

  if (value instanceof Set) {
    const backendSet = toBackendSet(value);
    if (!skipCache) {
      containerInterning.set(value, backendSet);
    }
    return backendSet.commitment();
  }

  if (Array.isArray(value)) {
    const backendArray = toBackendArray(value);
    if (!skipCache) {
      containerInterning.set(value, backendArray);
    }
    return backendArray.commitment();
  }

  if (typeof value === "object") {
    // TODO check this
    const dict = value as Record<string, EntryValue>;
    const backendDict = toBackendDictionary(dict);
    if (!skipCache) {
      containerInterning.set(value, backendDict);
    }
    return backendDict.commitment();
  }

  throw new Error("Invalid value");
}
