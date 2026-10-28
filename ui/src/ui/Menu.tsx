import { useEffect, useRef } from "react";
import styles from "./Menu.module.css";

export interface MenuItem {
  label: string;
  testId: string;
  danger?: boolean;
  onSelect(): void;
}

/** Small popover list; Escape and a click outside close it. */
export function Menu({ items, onClose }: { items: MenuItem[]; onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  return (
    <div ref={ref} className={styles.menu} role="menu" onClick={(e) => e.stopPropagation()}>
      {items.map((item) => (
        <button
          key={item.testId}
          type="button"
          role="menuitem"
          data-testid={item.testId}
          className={item.danger ? styles.danger : undefined}
          onClick={() => {
            onClose();
            item.onSelect();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
