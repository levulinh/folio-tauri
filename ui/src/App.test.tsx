import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeBackend } from "./backend/fakeBackend";

const fake = createFakeBackend();
vi.mock("./backend", () => ({ backend: fake }));

const { App } = await import("./App");
const { usePagesStore } = await import("./state/pagesStore");
const { useUiStore } = await import("./state/uiStore");

afterEach(cleanup);

describe("App initial load", () => {
  it("a failed pagesList still renders the shell and shows the error toast", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(fake, "pagesList").mockRejectedValueOnce({ code: "db", message: "boom" });
    usePagesStore.setState({ pages: [], loaded: false });
    useUiStore.setState({ toasts: [] });

    render(<App />);

    expect(screen.getByTestId("sidebar-new-page")).toBeTruthy();
    expect(await screen.findByTestId("toast")).toBeTruthy();
    expect(usePagesStore.getState().loaded).toBe(true);
  });
});
