import { act, cleanup, render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ appearanceGet: vi.fn(), appearanceSet: vi.fn() }));
vi.mock("../backend", () => ({ backend: api }));
import { AppearanceProvider } from "./AppearanceProvider";
import { useAppearanceStore } from "./appearanceStore";

afterEach(cleanup);

describe("AppearanceProvider", () => {
  it("keeps one listener in StrictMode, follows system and respects explicit selection", async () => {
    let dark = false;
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const query = {
      get matches() { return dark; },
      addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    };
    Object.defineProperty(window, "matchMedia", { configurable: true, value: () => query });
    api.appearanceGet.mockResolvedValue({ mode: "system", accent: "olive" });
    api.appearanceSet.mockResolvedValue(undefined);
    const view = render(<StrictMode><AppearanceProvider><div>content</div></AppearanceProvider></StrictMode>);
    await waitFor(() => expect(document.documentElement.dataset.accent).toBe("olive"));
    expect(api.appearanceGet).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(1);
    act(() => { dark = true; listeners.forEach((fn) => fn({ matches: true } as MediaQueryListEvent)); });
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(api.appearanceSet).not.toHaveBeenCalled();
    act(() => useAppearanceStore.getState().setPreferences({ mode: "light" }));
    act(() => { dark = false; listeners.forEach((fn) => fn({ matches: false } as MediaQueryListEvent)); dark = true; listeners.forEach((fn) => fn({ matches: true } as MediaQueryListEvent)); });
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.mantineColorScheme).toBe("light");
    view.unmount();
    expect(listeners.size).toBe(0);
  });
});
