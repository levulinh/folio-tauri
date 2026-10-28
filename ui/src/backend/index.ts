import type { Backend } from "./Backend";
import { createFakeBackend } from "./fakeBackend";
import { createTauriBackend } from "./tauriBackend";

declare global {
  interface Window {
    /** Set only with `VITE_BACKEND=fake`; Playwright uses it to emit menu events. */
    __folioFake?: ReturnType<typeof createFakeBackend>;
  }
}

function pickBackend(): Backend {
  if (import.meta.env.VITE_BACKEND === "fake") {
    const fake = createFakeBackend({ persistKey: "folio.fake.v1" });
    window.__folioFake = fake;
    return fake;
  }
  return createTauriBackend();
}

export const backend: Backend = pickBackend();
