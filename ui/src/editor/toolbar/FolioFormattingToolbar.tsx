import { BasicTextStyleButton, CreateLinkButton, FormattingToolbar, useBlockNoteEditor, useEditorSelectionChange } from "@blocknote/react";
import { useEffect, useReducer, useRef } from "react";
import type { FolioEditor } from "../schema";
import { shouldShowToolbar } from "./toolbarVisibility";

/** BlockNote's own `data-test` of each toolbar button -> our test id. */
const TEST_IDS: Record<string, string> = {
  bold: "fmt-bold",
  italic: "fmt-italic",
  underline: "fmt-underline",
  strike: "fmt-strike",
  code: "fmt-code",
  createLink: "fmt-link",
};

/**
 * The formatting toolbar: bold, italic, underline, strike, code, link and nothing else (tech spec
 * §5.14). BlockNote's controller decides when the toolbar opens and cannot be given a show
 * condition (`ToolbarVisibilitySync` aligns it), so `shouldShowToolbar` is applied here too: the
 * toolbar renders nothing when it says no, re-evaluated on selection changes and IME edges.
 */
export function FolioFormattingToolbar() {
  const editor = useBlockNoteEditor() as unknown as FolioEditor;
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  useEditorSelectionChange(refresh, editor);
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
  const holder = useRef<HTMLSpanElement>(null);
  // BlockNote's toolbar components forward no props, so the test ids are set on their DOM nodes.
  // Runs when the toolbar (re)appears; the buttons are static while it is shown.
  useEffect(() => {
    const node = holder.current;
    if (!node) return;
    node.closest(".bn-formatting-toolbar")?.setAttribute("data-testid", "fmt-toolbar");
    node.querySelectorAll("button[data-test]").forEach((b) => {
      const id = TEST_IDS[b.getAttribute("data-test") ?? ""];
      if (id) b.setAttribute("data-testid", id);
    });
  }, [show]);
  if (!show) return null;
  return (
    <FormattingToolbar>
      <span ref={holder} style={{ display: "contents" }}>
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
