import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeBackend } from "../backend/fakeBackend";
import type { SearchHit } from "../backend/generated/SearchHit";

const fake = createFakeBackend();
vi.mock("../backend", () => ({ backend: fake }));

const { SearchResults } = await import("./SearchResults");
const { usePageStore } = await import("../state/pageStore");
const { usePagesStore } = await import("../state/pagesStore");
const { useUiStore } = await import("../state/uiStore");

beforeEach(async () => {
  usePageStore.getState().close();
  useUiStore.setState({ toasts: [] });
  await usePagesStore.getState().load();
});
afterEach(cleanup);

describe("SearchResults", () => {
  it("clicking a result whose page was deleted toasts and drops it from the page list", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const gone = (await fake.pageCreate()).page;
    await usePagesStore.getState().load();
    expect(usePagesStore.getState().pages.some((p) => p.id === gone.id)).toBe(true);
    const hit: SearchHit = { pageId: gone.id, pageTitle: "Gone", snippet: "", titleMatch: false };
    await fake.pageDelete(gone.id);

    render(<SearchResults hits={[hit]} stale={false} />);
    fireEvent.click(screen.getByTestId("search-result"));

    await vi.waitFor(() => expect(useUiStore.getState().toasts).toHaveLength(1));
    await vi.waitFor(() => expect(usePagesStore.getState().pages.some((p) => p.id === gone.id)).toBe(false));
  });
});
