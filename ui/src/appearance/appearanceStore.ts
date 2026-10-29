import { create } from "zustand";
import { backend } from "../backend";
import type { Appearance } from "../backend/generated/Appearance";

type Mode = "light" | "dark";
type AppearanceState = {
  preferences: Appearance;
  resolvedMode: Mode;
  loaded: boolean;
  saving: boolean;
  error: "load" | "save" | null;
  load(): Promise<void>;
  setPreferences(patch: Partial<Appearance>): void;
  retry(): Promise<void>;
  flush(): Promise<void>;
};

const defaults: Appearance = { mode: "system", accent: "neutral" };
let systemDark = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
const resolve = (value: Appearance): Mode => value.mode === "system" ? (systemDark ? "dark" : "light") : value.mode;
let revision = 0;
let acknowledged = 0;
let failedRevision: number | null = null;
let failure: unknown;
let inFlight: Promise<void> | null = null;
let loading: Promise<void> | null = null;
let loadFailureRevision: number | null = null;
let loadFailure: unknown;

export const useAppearanceStore = create<AppearanceState>((set, get) => {
  function startWrite(): void {
    if (inFlight || revision === acknowledged || failedRevision === revision) return;
    const captured = revision;
    const value = { ...get().preferences };
    set({ saving: true });
    inFlight = Promise.resolve().then(() => backend.appearanceSet(value)).then(
      () => {
        acknowledged = captured;
        if (captured === revision) {
          failedRevision = null;
          failure = undefined;
          set({ error: null });
        }
      },
      (error: unknown) => {
        failedRevision = captured;
        failure = error;
        if (captured === revision) set({ error: "save" });
      },
    ).then(() => {
      inFlight = null;
      set({ saving: false });
      startWrite();
    });
  }

  async function drain(): Promise<void> {
    while (true) {
      startWrite();
      const pending = inFlight;
      if (pending) { await pending; continue; }
      if (revision !== acknowledged && failedRevision === revision) throw failure;
      return;
    }
  }

  function load(): Promise<void> {
    if (loading) return loading;
    if (get().loaded) return Promise.resolve();
    const captured = revision;
    loading = Promise.resolve().then(() => backend.appearanceGet()).then(
      (value) => {
        if (revision === captured) {
          loadFailureRevision = null;
          set({ preferences: value, resolvedMode: resolve(value), loaded: true, error: null });
        } else set({ loaded: true });
      }, (error: unknown) => {
        if (revision === captured) {
          loadFailure = error;
          loadFailureRevision = captured;
          set({ loaded: true, error: "load" });
        } else set({ loaded: true });
      },
    ).finally(() => { loading = null; });
    return loading;
  }

  return {
    preferences: defaults, resolvedMode: resolve(defaults), loaded: false, saving: false, error: null,
    load,
    setPreferences(patch) {
      const value = { ...get().preferences, ...patch };
      if (value.mode === get().preferences.mode && value.accent === get().preferences.accent) return;
      revision += 1;
      set({ preferences: value, resolvedMode: resolve(value), error: null });
      startWrite();
    },
    async retry() {
      if (get().error === "load" && loadFailureRevision === revision) {
        set({ loaded: false });
        await load();
        if (get().error === "load") throw loadFailure;
        return;
      }
      failedRevision = null;
      await drain();
    },
    flush: drain,
  };
});

export function updateSystemMode(dark: boolean): void {
  systemDark = dark;
  const { preferences } = useAppearanceStore.getState();
  useAppearanceStore.setState({ resolvedMode: resolve(preferences) });
}
