import { BasicTextStyleButton, CreateLinkButton, FormattingToolbar, useBlockNoteEditor, useEditorSelectionChange } from "@blocknote/react";
import { useEffect, useReducer, useRef } from "react";
import type { FolioEditor } from "../schema";
import { shouldShowToolbar } from "./toolbarVisibility";

const BUTTON_IDS = ["fmt-bold", "fmt-italic", "fmt-underline", "fmt-strike", "fmt-code", "fmt-link"];

/**
 * The formatting toolbar: bold, italic, underline, strike, code, link and nothing else (tech spec
 * §5.14). BlockNote's controller decides when the toolbar opens (non-empty selection) and cannot
 * be given a show condition, so `shouldShowToolbar` is applied here: the toolbar renders nothing
 * when it says no, and is re-evaluated on every selection change and on IME composition edges.
 */
export function FolioFormattingToolbar() {
  const editor = useBlockNoteEditor() as unknown as FolioEditor;
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  useEditorSelectionChange(refresh, editor as never);
  useEffect(() => {
    const dom = editor.prosemirrorView?.dom;
    if (!dom) return;
    dom.addEventListener("compositionstart", refresh);
    dom.addEventListener("compositionend", refresh);
    return () => {
      dom.removeEventListener("compositionstart", refresh);
      dom.removeEventListener("compositionend", refresh);
    };
  }, [editor]);
  const show = shouldShowToolbar(editor);
  const buttons = useRef<HTMLSpanElement>(null);
  // BlockNote's toolbar components forward no props, so the test ids are set on their DOM nodes.
  useEffect(() => {
    const holder = buttons.current;
    if (!holder) return;
    holder.closest(".bn-formatting-toolbar")?.setAttribute("data-testid", "fmt-toolbar");
    holder.querySelectorAll("button").forEach((b, i) => {
      const id = BUTTON_IDS[i];
      if (id) b.setAttribute("data-testid", id);
    });
  });
  if (!show) return null;
  return (
    <FormattingToolbar>
      <span ref={buttons} style={{ display: "contents" }}>
        <BasicTextStyleButton basicTextStyle="bold" />
        <BasicTextStyleButton basicTextStyle="italic" />
        <BasicTextStyleButton basicTextStyle="underline" />
        <BasicTextStyleButton basicTextStyle="strike" />
        <BasicTextStyleButton basicTextStyle="code" />
        <CreateLinkButton />
      </span>
    </FormattingToolbar>
  );
}
