import { useCallback, useEffect, useRef } from "react";
import { SettingsDialog } from "./appearance/SettingsDialog";
import { isSettingsShortcut } from "./platform/settingsShortcut";
import { backend } from "./backend";
import { routeMenuHistory } from "./editor/menuHistory";
import { EmptyState } from "./page/EmptyState";
import { PageView } from "./page/PageView";
import { Sidebar } from "./sidebar/Sidebar";
import { createAndOpenPage } from "./state/pageActions";
import { flushForQuit } from "./state/quitFlush";
import { usePageStore } from "./state/pageStore";
import { usePagesStore } from "./state/pagesStore";
import { reportError, useUiStore } from "./state/uiStore";
import { Toasts } from "./ui/Toast";
import styles from "./App.module.css";

export function App() {
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const composing = useRef(false);
  const deferred = useRef(false);
  const frame = useRef<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const openSettings = useCallback((source?: HTMLElement) => {
    if (useUiStore.getState().settingsOpen) return;
    if (composing.current || frame.current !== null) {
      if (!deferred.current) opener.current = source ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      deferred.current = true; return;
    }
    opener.current = source ?? (deferred.current ? opener.current : (document.activeElement instanceof HTMLElement ? document.activeElement : null));
    source?.focus();
    useUiStore.getState().setSettingsOpen(true);
  }, []);
  const closeSettings = useCallback(() => {
    useUiStore.getState().setSettingsOpen(false);
    const target = opener.current;
    requestAnimationFrame(() => target?.focus());
  }, []);
  const loaded = usePagesStore((s) => s.loaded);
  const empty = usePagesStore((s) => s.pages.length === 0);

  useEffect(() => {
    usePagesStore
      .getState()
      .load()
      .catch(reportError)
      .finally(() => usePagesStore.setState({ loaded: true }));
    const start = () => { composing.current = true; };
    const end = () => {
      composing.current = false;
      if (!deferred.current) return;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => { frame.current = null; if (!composing.current && deferred.current) { openSettings(opener.current ?? undefined); deferred.current = false; } });
    };
    const shortcut = (event: KeyboardEvent) => {
      if (isSettingsShortcut(event)) { event.preventDefault(); openSettings(); }
    };
    document.addEventListener("compositionstart", start, true);
    document.addEventListener("compositionend", end, true);
    document.addEventListener("keydown", shortcut, true);
    const offs = [
      backend.onMenu("settings", openSettings),
      backend.onMenu("new-page", () => { if (!useUiStore.getState().settingsOpen) void createAndOpenPage(); }),
      backend.onMenu("new-subpage", () => {
        if (useUiStore.getState().settingsOpen) return;
        const current = usePageStore.getState().pageId;
        if (current !== null) void createAndOpenPage(current);
      }),
      backend.onMenu("undo", () => { if (!useUiStore.getState().settingsOpen) routeMenuHistory("undo"); }),
      backend.onMenu("redo", () => { if (!useUiStore.getState().settingsOpen) routeMenuHistory("redo"); }),
      backend.onFlushRequest(flushForQuit),
    ];
    return () => {
      offs.forEach((off) => off());
      document.removeEventListener("compositionstart", start, true);
      document.removeEventListener("compositionend", end, true);
      document.removeEventListener("keydown", shortcut, true);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null; deferred.current = false; composing.current = false;
    };
  }, [openSettings]);

  return (
    <div className={styles.app}>
      <Sidebar onOpenSettings={openSettings} />
      <main className={styles.main}>
        <div className={styles.drag} data-tauri-drag-region />
        {loaded && empty ? <EmptyState /> : <PageView />}
      </main>
      <Toasts />
      {settingsOpen && <SettingsDialog onClose={closeSettings} />}
    </div>
  );
}
