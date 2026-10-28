import { useEffect, useRef, useState } from "react";
import { vi } from "../i18n/vi";
import { usePageStore } from "../state/pageStore";
import { usePagesStore } from "../state/pagesStore";
import { reportError } from "../state/uiStore";
import styles from "./PageView.module.css";

const SAVE_DELAY_MS = 400;

/** Single-line page title. Stored exactly as typed (no trim); saved 400 ms after the last change and on blur. */
export function PageTitle({ pageId }: { pageId: string }) {
  const stored = usePagesStore((s) => s.pages.find((p) => p.id === pageId)?.title ?? "");
  const [value, setValue] = useState(stored);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(value);

  // Follow renames made elsewhere (sidebar) while we have no unsaved edit.
  useEffect(() => {
    if (!dirty.current) {
      latest.current = stored;
      setValue(stored);
    }
  }, [stored]);

  const save = () => {
    clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    const title = latest.current;
    if (title === (usePagesStore.getState().pages.find((p) => p.id === pageId)?.title ?? "")) return;
    usePagesStore.getState().rename(pageId, title).catch(reportError);
  };
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => () => saveRef.current(), []);

  return (
    <input
      className={styles.title}
      data-testid="page-title"
      value={value}
      placeholder={vi.untitled}
      onChange={(e) => {
        latest.current = e.target.value;
        dirty.current = true;
        setValue(e.target.value);
        clearTimeout(timer.current);
        timer.current = setTimeout(save, SAVE_DELAY_MS);
      }}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
        e.preventDefault();
        save();
        const editor = usePageStore.getState().activeEditor;
        if (!editor) return;
        const first = editor.document[0];
        if (first) editor.setTextCursorPosition(first, "start");
        editor.focus();
      }}
    />
  );
}
