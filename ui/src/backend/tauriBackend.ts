import { invoke } from "@tauri-apps/api/core";
import { listenMenu } from "../platform/menuEvents";
import { listenFlushRequest } from "../platform/quit";
import type { Backend } from "./Backend";
import { Commands } from "./generated/commands";

export function createTauriBackend(): Backend {
  return {
    pagesList: () => invoke(Commands.pagesList),
    pageCreate: (parentId, afterId) => invoke(Commands.pageCreate, { parentId, afterId }),
    pageRename: (id, title) => invoke(Commands.pageRename, { id, title }),
    pageDelete: (id) => invoke(Commands.pageDelete, { id }),
    tabsList: (pageId) => invoke(Commands.tabsList, { pageId }),
    tabLoad: (tabId) => invoke(Commands.tabLoad, { tabId }),
    tabApply: (tabId, ops) => invoke(Commands.tabApply, { tabId, ops }),
    search: (query) => invoke(Commands.search, { query }),
    onMenu: listenMenu,
    onFlushRequest: listenFlushRequest,
    quitReady: () => invoke(Commands.quitReady),
  };
}
