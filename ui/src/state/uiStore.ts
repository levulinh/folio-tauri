import { create } from "zustand";
import { isErrorPayload } from "../backend/Backend";
import { vi } from "../i18n/vi";

interface Toast {
  id: string;
  text: string;
}

interface UiState {
  settingsOpen: boolean;
  setSettingsOpen(v: boolean): void;
  findOpen: boolean;
  setFindOpen(v: boolean): void;
  /** Page whose title input should take focus when it mounts (set right after creating a page). */
  titleFocusPageId: string | null;
  requestTitleFocus(pageId: string): void;
  /** Drops the request, but only if it is still the one for `pageId` (a newer create may have replaced it). */
  clearTitleFocus(pageId: string): void;
  toasts: Toast[];
  toast(text: string): void;
  dismissToast(id: string): void;
}

let nextToast = 0;

export const useUiStore = create<UiState>((set) => ({
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  findOpen: false,
  setFindOpen: (findOpen) => set({ findOpen }),
  titleFocusPageId: null,
  requestTitleFocus: (titleFocusPageId) => set({ titleFocusPageId }),
  clearTitleFocus: (pageId) =>
    set((s) => (s.titleFocusPageId === pageId ? { titleFocusPageId: null } : s)),
  toasts: [],
  toast: (text) =>
    set((s) => ({ toasts: [...s.toasts, { id: `toast-${(nextToast += 1)}`, text }] })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Shows a backend error as a toast with its Vietnamese text (unknown codes fall back to `db`). */
export function reportError(e: unknown): void {
  console.error(e);
  const code = isErrorPayload(e) ? e.code : "";
  const text = Object.hasOwn(vi.errors, code) ? vi.errors[code as keyof typeof vi.errors] : vi.errors.db;
  useUiStore.getState().toast(text);
}
