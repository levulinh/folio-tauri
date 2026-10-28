import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Commands } from "../backend/generated/commands";

/**
 * Runs `flush` when the shell asks for it (quit / window close), then tells the shell it may
 * exit. The shell also exits on its own timeout, so a failing flush must not block quitting.
 */
export function listenFlushRequest(flush: () => Promise<void>): () => void {
  const pending = listen("flush-request", async () => {
    try {
      await flush();
    } finally {
      await invoke(Commands.quitReady);
    }
  });
  return () => void pending.then((off) => off());
}
