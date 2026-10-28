import { useEffect, useRef, useState } from "react";
import { vi } from "../i18n/vi";
import { registerTitleFlush } from "../state/quitFlush";
import { usePageStore } from "../state/pageStore";
import { usePagesStore } from "../state/pagesStore";
import { reportError, useUiStore } from "../state/uiStore";
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

  /** Saves a pending edit now; the promise settles when the rename has been stored (errors toast). */
  const save = (): Promise<void> => {
    clearTimeout(timer.current);
    if (!dirty.current) return Promise.resolve();
    dirty.current = false;
    const title = latest.current;
    const page = usePagesStore.getState().pages.find((p) => p.id === pageId);
    if (!page || page.title === title) return Promise.resolve(); // deleted mid-debounce: drop silently
    return usePagesStore.getState().rename(pageId, title).catch(reportError);
  };
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => () => void saveRef.current(), []);
  // A quit must not lose a rename still waiting for its debounce.
  useEffect(() => registerTitleFlush(() => saveRef.current()), []);
  // A page just created from the menu / sidebar button starts with the caret in its title.
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (useUiStore.getState().titleFocusPageId !== pageId) return;
    useUiStore.getState().clearTitleFocus();
    inputRef.current?.focus();
  }, [pageId]);

  return (
    <input
      ref={inputRef}
      className={styles.title}
      data-testid="page-title"
      value={value}
      placeholder={vi.untitled}
      onChange={(e) => {
        latest.current = e.target.value;
        dirty.current = true;
        setValue(e.target.value);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => void save(), SAVE_DELAY_MS);
      }}
      onBlur={() => void save()}
      onKeyDown={(e) => {
        // WebKit delivers the Enter that commits a Telex/VNI composition after compositionend,
        // with isComposing false and keyCode 229.
        if (e.key !== "Enter" || e.nativeEvent.isComposing || e.keyCode === 229) return;
        e.preventDefault();
        void save();
        const editor = usePageStore.getState().activeEditor;
        if (!editor) return;
        const first = editor.document[0];
        if (first) editor.setTextCursorPosition(first, "start");
        editor.focus();
      }}
    />
  );
}
