import { useEffect } from "react";
import { backend } from "./backend";
import { routeMenuHistory } from "./editor/menuHistory";
import { EmptyState } from "./page/EmptyState";
import { PageView } from "./page/PageView";
import { Sidebar } from "./sidebar/Sidebar";
import { createAndOpenPage } from "./state/pageActions";
import { flushForQuit } from "./state/quitFlush";
import { usePageStore } from "./state/pageStore";
import { usePagesStore } from "./state/pagesStore";
import { reportError } from "./state/uiStore";
import { Toasts } from "./ui/Toast";
import styles from "./App.module.css";

export function App() {
  const loaded = usePagesStore((s) => s.loaded);
  const empty = usePagesStore((s) => s.pages.length === 0);

  useEffect(() => {
    usePagesStore
      .getState()
      .load()
      .catch(reportError)
      .finally(() => usePagesStore.setState({ loaded: true }));
    const offs = [
      backend.onMenu("new-page", () => void createAndOpenPage()),
      backend.onMenu("new-subpage", () => {
        const current = usePageStore.getState().pageId;
        if (current !== null) void createAndOpenPage(current);
      }),
      backend.onMenu("undo", () => routeMenuHistory("undo")),
      backend.onMenu("redo", () => routeMenuHistory("redo")),
      backend.onFlushRequest(flushForQuit),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  return (
    <div className={styles.app}>
      <Sidebar />
      <main className={styles.main}>
        <div className={styles.drag} data-tauri-drag-region />
        {loaded && empty ? <EmptyState /> : <PageView />}
      </main>
      <Toasts />
    </div>
  );
}
