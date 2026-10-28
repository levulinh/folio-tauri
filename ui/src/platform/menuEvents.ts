import { listen } from "@tauri-apps/api/event";
import type { MenuEvent } from "../backend/Backend";

/** Subscribes to a native menu item (`menu:<name>`); returns the unsubscribe function. */
export function listenMenu(name: MenuEvent, cb: () => void): () => void {
  const pending = listen(`menu:${name}`, () => cb());
  return () => void pending.then((off) => off());
}
