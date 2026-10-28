import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeBackend } from "../backend/fakeBackend";

const fake = createFakeBackend();
vi.mock("../backend", () => ({ backend: fake }));

const { usePageStore } = await import("./pageStore");

beforeEach(() => {
  usePageStore.getState().close();
});

describe("pageStore.open", () => {
  it("last click wins: re-opening the current page cancels an in-flight open of another", async () => {
    const a = (await fake.pageCreate()).page;
    const b = (await fake.pageCreate()).page;
    await usePageStore.getState().open(a.id);
    const inFlight = usePageStore.getState().open(b.id);
    await usePageStore.getState().open(a.id); // user clicks the still-current A
    await inFlight;
    expect(usePageStore.getState().pageId).toBe(a.id);
  });

  it("a newer open of another page wins over an older in-flight one", async () => {
    const a = (await fake.pageCreate()).page;
    const b = (await fake.pageCreate()).page;
    const first = usePageStore.getState().open(a.id);
    await usePageStore.getState().open(b.id);
    await first;
    expect(usePageStore.getState().pageId).toBe(b.id);
  });
});
