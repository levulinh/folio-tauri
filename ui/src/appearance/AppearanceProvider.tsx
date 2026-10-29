import { MantineProvider } from "@mantine/core";
import { useLayoutEffect, type ReactNode } from "react";
import { updateSystemMode, useAppearanceStore } from "./appearanceStore";

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const mode = useAppearanceStore((s) => s.resolvedMode);
  const accent = useAppearanceStore((s) => s.preferences.accent);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = mode;
    document.documentElement.dataset.accent = accent;
  }, [mode, accent]);
  useLayoutEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const change = (event: MediaQueryListEvent) => updateSystemMode(event.matches);
    updateSystemMode(media.matches);
    media.addEventListener("change", change);
    void useAppearanceStore.getState().load();
    return () => media.removeEventListener("change", change);
  }, []);
  return <MantineProvider forceColorScheme={mode}>{children}</MantineProvider>;
}
