import { sha256 } from "js-sha256";
import { POD2Set, POD2Array, POD2Dictionary } from "./containers/containers.js";
import type { ContainerValue, Value } from "./frontend.js";

export const containerInterning = new WeakMap<
  ContainerValue,
  POD2Set | POD2Array | POD2Dictionary
>();

function toBackendSet(set: Set<Value>): POD2Set {
  const values = Array.from(set).map((value) => toBackendValue(value));
  return new POD2Set(values);
}

function toBackendArray(array: Value[]): POD2Array {
  const values = array.map((value) => toBackendValue(value));
  return new POD2Array(values);
}

function toBackendDictionary(dict: Record<string, Value>): POD2Dictionary {
  const values = new Map(
    Object.entries(dict).map(([key, value]) => [toBackendValue(key), toBackendValue(value)])
  );
  return new POD2Dictionary(values);
}

export function toBackendValue(value: Value, skipCache = false): bigint {
  if (typeof value === "string") {
    return BigInt("0x" + sha256(value));
  }

  if (typeof value === "bigint") {
    return value;
  }

  // TODO freeze object types?
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
    const dict = value as Record<string, Value>;
    const backendDict = toBackendDictionary(dict);
    if (!skipCache) {
      containerInterning.set(value, backendDict);
    }
    return backendDict.commitment();
  }

  throw new Error("Invalid value");
}