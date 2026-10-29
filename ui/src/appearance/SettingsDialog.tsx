import { Modal } from "@mantine/core";
import { useEffect, useRef } from "react";
import { vi } from "../i18n/vi";
import { useAppearanceStore } from "./appearanceStore";
import styles from "./SettingsDialog.module.css";

export function SettingsDialog({ onClose }: { onClose(): void }) {
  const { preferences, saving, error, setPreferences, retry } = useAppearanceStore();
  const composing = useRef(false);
  useEffect(() => {
    const start = () => { composing.current = true; };
    const end = () => { composing.current = false; };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || composing.current || event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("compositionstart", start, true);
    document.addEventListener("compositionend", end, true);
    document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("compositionstart", start, true); document.removeEventListener("compositionend", end, true); document.removeEventListener("keydown", key, true); };
  }, [onClose]);
  return <Modal opened onClose={onClose} title={vi.appearance.settings} size={480} closeOnEscape={false}
    withCloseButton={false} returnFocus
    classNames={{ content: styles.content, body: styles.body }}>
    <div data-testid="appearance-settings">
    <button type="button" data-autofocus data-testid="appearance-close" aria-label={vi.appearance.close} onClick={onClose}>×</button>
    <h2>{vi.appearance.heading}</h2>
    <fieldset><legend>{vi.appearance.mode}</legend>
      {(["system", "light", "dark"] as const).map((mode) => <label key={mode} className={styles.option}>
        <input type="radio" name="appearance-mode" data-testid={`appearance-mode-${mode}`} checked={preferences.mode === mode} onChange={() => setPreferences({ mode })} /> {vi.appearance[mode]}
      </label>)}
    </fieldset>
    <fieldset><legend>{vi.appearance.accent}</legend>
      {(["neutral", "blue", "olive", "purple"] as const).map((accent) => <label key={accent} className={styles.option}>
        <input type="radio" name="appearance-accent" data-testid={`appearance-accent-${accent}`} checked={preferences.accent === accent} onChange={() => setPreferences({ accent })} /> <span aria-hidden="true" className={styles.swatch} data-swatch={accent} /> {vi.appearance[accent]}
      </label>)}
    </fieldset>
    {saving && <p role="status">{vi.appearance.saving}</p>}
    {error && <div role="alert">{error === "load" ? vi.appearance.loadError : vi.appearance.saveError} <button type="button" data-testid="appearance-retry" onClick={() => void retry().catch(() => {})}>{vi.appearance.retry}</button></div>}
    </div>
  </Modal>;
}
