import { act, cleanup, render } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeBackend } from "../backend/fakeBackend";

const fake = createFakeBackend();
vi.mock("../backend", () => ({ backend: fake }));

const counts = { created: 0, disposed: 0 };
vi.mock("./savePipeline", async (orig) => {
  const mod = await orig<typeof import("./savePipeline")>();
  return {
    ...mod,
    createSavePipeline: (o: Parameters<typeof mod.createSavePipeline>[0]) => {
      counts.created += 1;
      const p = mod.createSavePipeline(o);
      const dispose = p.dispose;
      p.dispose = () => {
        counts.disposed += 1;
        dispose();
      };
      return p;
    },
  };
});

const { Editor } = await import("./Editor");

Object.defineProperty(window, "matchMedia", {
  value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Editor under StrictMode", () => {
  it("leaves exactly one live pipeline after mount", async () => {
    const page = (await fake.pageCreate()).page;
    const [tab] = await fake.tabsList(page.id);
    // A failing backend keeps unsaved pipelines alive: an orphaned twin would not dispose itself.
    vi.spyOn(fake, "tabApply").mockRejectedValue({ code: "db", message: "down" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <StrictMode>
        <Editor tabId={tab!.id} />
      </StrictMode>,
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(counts.created).toBeGreaterThanOrEqual(2); // the double effect really ran
    expect(counts.created - counts.disposed).toBe(1);
  });
});
