import type { Appearance } from "./generated/Appearance";
import type { ApplyResult } from "./generated/ApplyResult";
import type { BlockNode } from "./generated/BlockNode";
import type { BlockOp } from "./generated/BlockOp";
import type { CreatedPage } from "./generated/CreatedPage";
import type { ErrorPayload } from "./generated/ErrorPayload";
import type { PageMeta } from "./generated/PageMeta";
import type { SearchHit } from "./generated/SearchHit";
import type { TabMeta } from "./generated/TabMeta";

export type MenuEvent = "settings" | "new-page" | "new-subpage" | "find" | "search" | "undo" | "redo";

/** Everything the UI may ask of the backend. Every method rejects with an `ErrorPayload`. */
export interface Backend {
  appearanceGet(): Promise<Appearance>;
  appearanceSet(appearance: Appearance): Promise<void>;
  pagesList(): Promise<PageMeta[]>;
  pageCreate(parentId?: string, afterId?: string): Promise<CreatedPage>;
  pageRename(id: string, title: string): Promise<PageMeta>;
  pageDelete(id: string): Promise<string[]>;
  tabsList(pageId: string): Promise<TabMeta[]>;
  tabLoad(tabId: string): Promise<BlockNode[]>;
  tabApply(tabId: string, ops: BlockOp[]): Promise<ApplyResult>;
  search(query: string): Promise<SearchHit[]>;
  /** Returns the unsubscribe function. */
  onMenu(name: MenuEvent, cb: () => void): () => void;
  onFlushRequest(cb: () => Promise<void>): () => void;
  quitReady(): Promise<void>;
}

export function isErrorPayload(e: unknown): e is ErrorPayload {
  return (
    typeof e === "object" &&
    e !== null &&
    typeof (e as ErrorPayload).code === "string" &&
    typeof (e as ErrorPayload).message === "string"
  );
}
