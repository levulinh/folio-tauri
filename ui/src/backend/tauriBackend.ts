import { imageMime } from "./imageValidation";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { toWellFormed } from "../lib/wellFormed";
import { listenMenu } from "../platform/menuEvents";
import { listenFlushRequest } from "../platform/quit";
import { isErrorPayload, type Backend } from "./Backend";
import { Commands } from "./generated/commands";

/**
 * Every backend method rejects with an `ErrorPayload`. Tauri itself rejects with a plain string
 * when it cannot deserialize the arguments; that becomes `invalid_op` so callers do a full resync
 * instead of retrying the same doomed request forever.
 */
async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (e) {
    if (isErrorPayload(e)) throw e;
    console.error(`backend: ${command} failed with a non-ErrorPayload rejection`, e);
    throw { code: "invalid_op", message: typeof e === "string" ? e : String(e) };
  }
}

export function createTauriBackend(): Backend {
  return {
    assetImport: async (file) => {
      try {
        if (file.size > 20 * 1024 * 1024) throw { code: "invalid_op", message: "Image exceeds 20 MiB" };
        const bytes = await file.arrayBuffer();
        imageMime(file.name, new Uint8Array(bytes));
        return await invoke(Commands.assetImport, bytes, { headers: { "x-file-name": encodeURIComponent(file.name) } }); }
      catch (e) { if (isErrorPayload(e)) throw e; throw { code: "io", message: String(e) }; }
    },
    assetDisplayUrl: (url) => url.startsWith("folio-asset:") ? convertFileSrc(url.slice("folio-asset:".length), "folio-asset") : "",
    appearanceGet: () => call(Commands.appearanceGet),
    appearanceSet: (appearance) => call(Commands.appearanceSet, { appearance }),
    pagesList: () => call(Commands.pagesList),
    pageCreate: (parentId, afterId) => call(Commands.pageCreate, { parentId, afterId }),
    pageRename: (id, title) => call(Commands.pageRename, { id, title: toWellFormed(title) }),
    pageDelete: (id) => call(Commands.pageDelete, { id }),
    tabsList: (pageId) => call(Commands.tabsList, { pageId }),
    tabLoad: (tabId) => call(Commands.tabLoad, { tabId }),
    tabApply: (tabId, ops) => call(Commands.tabApply, { tabId, ops }),
    search: (query) => call(Commands.search, { query: toWellFormed(query) }),
    onMenu: listenMenu,
    onFlushRequest: listenFlushRequest,
    quitReady: () => call(Commands.quitReady),
  };
}
