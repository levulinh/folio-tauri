import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { backend } from "../../backend";
import { vi } from "../../i18n/vi";
import { usePageStore } from "../../state/pageStore";
import { useUiStore } from "../../state/uiStore";
import type { FolioEditor } from "../schema";
import { EMPTY_FIND_STATE, findExtension, findPluginKey, type FindAction, type FindState } from "./findPlugin";
import styles from "./FindBar.module.css";

const noopSubscribe = () => () => {};

function dispatchFind(editor: FolioEditor, action: FindAction): void {
  // Meta-only transaction: selection and document are untouched.
  editor.transact((tr) => tr.setMeta(findPluginKey, action));
}

/** Scrolls the current match to the middle of the view without touching the selection. */
function scrollToCurrent(editor: FolioEditor, state: FindState): void {
  const match = state.matches[state.current];
  if (!match) return;
  const { node } = editor.prosemirrorView.domAtPos(match.from);
  const el = node instanceof Element ? node : node.parentElement;
  el?.scrollIntoView({ block: "center" });
}

function counterText(state: FindState): string {
  if (state.query.trim() === "") return "";
  if (state.matches.length === 0) return vi.findNoMatch;
  return `${state.current + 1}/${state.matches.length}`;
}

/** Find-in-page bar (tech spec §5.10): top-right, decorations only, never moves the selection. */
export function FindBar() {
  const open = useUiStore((s) => s.findOpen);
  const setOpen = useUiStore((s) => s.setFindOpen);
  const editor = usePageStore((s) => s.activeEditor);
  const store = editor?.getExtension(findExtension)?.store;
  const state = useSyncExternalStore(store?.subscribe ?? noopSubscribe, () => store?.state ?? EMPTY_FIND_STATE);

  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [query, setQuery] = useState(""); // committed text: never mid-composition
  const [composing, setComposing] = useState(false);
  const [focusTick, setFocusTick] = useState(0);

  useEffect(
    () =>
      backend.onMenu("find", () => {
        setOpen(true);
        setFocusTick((t) => t + 1);
      }),
    [setOpen],
  );

  // A remount must not come back open-but-empty: the text state lives here.
  useEffect(() => () => setOpen(false), [setOpen]);

  const close = () => {
    setOpen(false);
    editor?.focus();
  };
  const closeRef = useRef(close);
  closeRef.current = close;
  // Escape with focus in the editor also closes. ProseMirror's keymap marks Escape handled
  // during bubbling, so listen while capturing (before it) and leave an open BlockNote menu to
  // its own Escape. The bar's own input handles Escape itself.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing || e.keyCode === 229) return;
      if (!(e.target instanceof Element) || !e.target.closest(".bn-editor")) return;
      if (document.querySelector(".bn-suggestion-menu")) return;
      closeRef.current();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [open, focusTick]);

  // Keep the editor's decorations in step with open / query / which editor is active.
  useEffect(() => {
    if (!editor || !store) return;
    if (open) {
      dispatchFind(editor, { type: "query", query });
      scrollToCurrent(editor, store.state);
    } else if (store.state.query !== "") {
      dispatchFind(editor, { type: "clear" });
    }
  }, [open, query, editor, store]);

  if (!open) return null;

  const step = (delta: number) => {
    if (!editor || !store || state.matches.length === 0) return;
    const count = state.matches.length;
    dispatchFind(editor, { type: "current", index: (state.current + delta + count) % count });
    scrollToCurrent(editor, store.state);
  };
  const onText = (value: string, isComposing: boolean) => {
    setText(value);
    if (!composing && !isComposing) setQuery(value);
  };

  return (
    <div className={styles.bar} data-testid="find-bar" role="search">
      <input
        ref={inputRef}
        className={styles.input}
        data-testid="find-input"
        aria-label={vi.find}
        placeholder={vi.find}
        value={text}
        onChange={(e) => onText(e.target.value, (e.nativeEvent as InputEvent).isComposing)}
        onCompositionStart={() => setComposing(true)}
        onBlur={() => setComposing(false)}
        onCompositionEnd={(e) => {
          setComposing(false);
          setQuery(e.currentTarget.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            if (composing || e.nativeEvent.isComposing || e.keyCode === 229) return;
            e.preventDefault();
            close();
            return;
          }
          // WebKit sends the composition-commit Enter after compositionend with keyCode 229.
          if (e.key !== "Enter" || composing || e.nativeEvent.isComposing || e.keyCode === 229) return;
          e.preventDefault();
          step(e.shiftKey ? -1 : 1);
        }}
      />
      <span className={styles.count} data-testid="find-count">
        {counterText(state)}
      </span>
      <button type="button" className={styles.button} data-testid="find-prev" aria-label={vi.findPrev} onClick={() => step(-1)}>
        ↑
      </button>
      <button type="button" className={styles.button} data-testid="find-next" aria-label={vi.findNext} onClick={() => step(1)}>
        ↓
      </button>
      <button type="button" className={styles.button} data-testid="find-close" aria-label={vi.findClose} onClick={close}>
        ×
      </button>
    </div>
  );
}
