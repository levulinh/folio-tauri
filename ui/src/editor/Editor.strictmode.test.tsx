import { BlockNoteEditor } from "@blocknote/core";
import { act, cleanup, render } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeBackend } from "../backend/fakeBackend";

const fake = createFakeBackend();
vi.mock("../backend", () => ({ backend: fake }));

const { Editor } = await import("./Editor");
const { usePageStore } = await import("../state/pageStore");
const { useAppearanceStore } = await import("../appearance/appearanceStore");

Object.defineProperty(window, "matchMedia", {
  value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
});

/** Counts onChange subscriptions that are still active. */
let active = 0;
const realOnChange = BlockNoteEditor.prototype.onChange;
vi.spyOn(BlockNoteEditor.prototype, "onChange").mockImplementation(function (this: BlockNoteEditor, ...args: never[]) {
  const off = (realOnChange as (...a: unknown[]) => () => void).apply(this, args);
  // Only the save pipeline's subscriptions count (BlockNote subscribes internally too).
  if (!new Error().stack?.includes("savePipeline")) return off;
  active += 1;
  let done = false;
  return () => {
    if (!done) {
      done = true;
      active -= 1;
    }
    off();
  };
} as never);

const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 100));
  });

afterEach(async () => {
  cleanup();
  await settle();
  vi.mocked(fake.tabApply).mockRestore?.();
});

async function newTab() {
  const page = (await fake.pageCreate()).page;
  const [tab] = await fake.tabsList(page.id);
  return tab!.id;
}

describe("Editor under StrictMode", () => {
  it("strictmode_editor_has_one_subscriber", async () => {
    const tabId = await newTab();
    // A failing backend keeps the pipeline alive: nothing may hide an extra subscriber.
    vi.spyOn(fake, "tabApply").mockRejectedValue({ code: "db", message: "down" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const before = active;
    render(
      <StrictMode>
        <Editor tabId={tabId} />
      </StrictMode>,
    );
    await settle();
    expect(active - before).toBe(1);
  });

  it("strictmode_reopen_while_failing_keeps_unsaved_text_and_one_subscriber", async () => {
    const tabId = await newTab();
    vi.spyOn(fake, "tabApply").mockRejectedValue({ code: "db", message: "down" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const before = active;
    const first = render(
      <StrictMode>
        <Editor tabId={tabId} />
      </StrictMode>,
    );
    await settle();
    const editor1 = usePageStore.getState().activeEditor!;
    act(() => {
      editor1.updateBlock(editor1.document[0]!, { content: "chưa lưu" });
    });
    first.unmount();
    await settle();
    expect(active - before).toBe(0); // detached
    render(
      <StrictMode>
        <Editor tabId={tabId} />
      </StrictMode>,
    );
    await settle();
    const editor2 = usePageStore.getState().activeEditor!;
    expect(editor2).not.toBe(editor1);
    expect(JSON.stringify(editor2.document[0]!.content)).toContain("chưa lưu");
    expect(active - before).toBe(1);
  });
  it("changes editor theme without replacing the editor or its text", async () => {
    const tabId = await newTab();
    const view = render(<StrictMode><Editor tabId={tabId} /></StrictMode>);
    await settle();
    const editor = usePageStore.getState().activeEditor!;
    act(() => { editor.updateBlock(editor.document[0]!, { content: "preserved text" }); });
    act(() => useAppearanceStore.getState().setPreferences({ mode: "dark" }));
    await settle();
    expect(usePageStore.getState().activeEditor).toBe(editor);
    expect(JSON.stringify(editor.document)).toContain("preserved text");
    expect(view.getByTestId("editor").getAttribute("data-color-scheme")).toBe("dark");
  });

});
