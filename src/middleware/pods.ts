import type { BackendSignedPod } from "../backends/pods.js";
import type {
  DeepReadonly,
  EdDSAPodData,
  Entries
} from "../frontends/eddsa_signed.js";

const pods: WeakMap<EdDSAPodData<Entries>, BackendSignedPod> = new WeakMap();

export function registerPod(
  pod: DeepReadonly<EdDSAPodData<Entries>>,
  backend: BackendSignedPod
): void {
  pods.set(pod, backend);
}

export function getPod(
  pod: EdDSAPodData<Entries>
): BackendSignedPod | undefined {
  return pods.get(pod);
}
