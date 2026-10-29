import { useState, type RefObject } from "react";
import { vi } from "../i18n/vi";
import styles from "./SearchBox.module.css";

interface Props {
  onQueryChange(query: string): void;
  onEnter(): void;
  inputRef: RefObject<HTMLInputElement | null>;
}

/** Search input. Never reports a query or reacts to Enter while an IME composition is active. */
export function SearchBox({ onQueryChange, onEnter, inputRef }: Props) {
  const [text, setText] = useState("");
  const [composing, setComposing] = useState(false);

  return (
    <div className={styles.search}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
      <input
        ref={inputRef}
        className={styles.box}
        data-testid="search-input"
        type="search"
        aria-label={vi.searchPlaceholder}
        value={text}
        placeholder={vi.searchPlaceholder}
        onChange={(e) => {
          setText(e.target.value);
          if (!composing && !(e.nativeEvent as InputEvent).isComposing) onQueryChange(e.target.value);
        }}
        onCompositionStart={() => setComposing(true)}
        onBlur={() => setComposing(false)}
        onCompositionEnd={(e) => {
          setComposing(false);
          onQueryChange(e.currentTarget.value);
        }}
        onKeyDown={(e) => {
          const composingNow = composing || e.nativeEvent.isComposing || e.keyCode === 229;
          if (e.key === "Escape") {
            if (composingNow) return; // Escape cancels the IME composition, not the query
            setText("");
            onQueryChange("");
            return;
          }
          // WebKit sends the composition-commit Enter after compositionend with keyCode 229.
          if (e.key !== "Enter" || composingNow) return;
          e.preventDefault();
          onEnter();
        }}
      />
    </div>
  );
}
