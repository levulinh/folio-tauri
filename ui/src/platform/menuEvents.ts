import { listen } from "@tauri-apps/api/event";
import type { MenuEvent } from "../backend/Backend";

/** Subscribes to a native menu item (`menu:<name>`); returns the unsubscribe function (idempotent). */
export function listenMenu(name: MenuEvent, cb: () => void): () => void {
  const pending = listen(`menu:${name}`, () => cb());
  let done = false;
  return () => {
    if (done) return;
    done = true;
    pending.then((off) => off()).catch((e) => console.error("menu unlisten failed", e));
  };
}
