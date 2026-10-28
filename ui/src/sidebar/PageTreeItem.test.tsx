import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PageMeta } from "../backend/generated/PageMeta";

vi.mock("../backend", () => ({ backend: {} }));
vi.mock("../state/pageActions", () => ({ createAndOpenPage: vi.fn(), openPage: vi.fn() }));

import { usePagesStore } from "../state/pagesStore";
import { PageTreeItem } from "./PageTreeItem";

const page: PageMeta = { id: "p1", parentId: null, title: "Cũ", orderKey: "a", createdAt: 0, updatedAt: 0 };
const rename = vi.fn(() => Promise.resolve());

function startRename(): HTMLInputElement {
  render(<PageTreeItem page={page} depth={0} expanded={new Set()} setExpanded={() => {}} onRequestDelete={() => {}} />);
  fireEvent.click(screen.getByTestId("tree-item-menu"));
  fireEvent.click(screen.getByTestId("menu-rename"));
  return screen.getByTestId("tree-item-rename") as HTMLInputElement;
}

beforeEach(() => {
  rename.mockClear();
  usePagesStore.setState({ pages: [page], rename } as never);
});
afterEach(cleanup);

describe("PageTreeItem inline rename and IME", () => {
  it("Enter that commits an IME word (isComposing or keyCode 229) does not finish the rename", () => {
    const input = startRename();
    fireEvent.change(input, { target: { value: "Mới" } });
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(screen.queryByTestId("tree-item-rename")).not.toBeNull();
    expect(rename).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter", keyCode: 13 });
    expect(rename).toHaveBeenCalledWith("p1", "Mới");
  });

  it("Escape while composing does not cancel the rename", () => {
    const input = startRename();
    fireEvent.keyDown(input, { key: "Escape", isComposing: true });
    fireEvent.keyDown(input, { key: "Escape", keyCode: 229 });
    expect(screen.queryByTestId("tree-item-rename")).not.toBeNull();
    fireEvent.keyDown(input, { key: "Escape", keyCode: 27 });
    expect(screen.queryByTestId("tree-item-rename")).toBeNull();
    expect(rename).not.toHaveBeenCalled();
  });
});
