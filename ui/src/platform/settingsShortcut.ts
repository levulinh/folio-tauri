/** Browser preview has no native menu; Tauri handles its accelerator itself. */
export function isSettingsShortcut(event: KeyboardEvent): boolean {
  return import.meta.env.VITE_BACKEND === "fake" && !event.isComposing && event.keyCode !== 229 &&
    (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key === ",";
}
