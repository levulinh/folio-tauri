import { useEffect, useRef } from "react";
import { vi } from "../i18n/vi";
import styles from "./ConfirmDialog.module.css";

interface Props {
  message: string;
  confirmLabel: string;
  onConfirm(): void;
  onCancel(): void;
}

export function ConfirmDialog({ message, confirmLabel, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className={styles.backdrop} onMouseDown={onCancel}>
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-label={message}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className={styles.message}>{message}</p>
        <div className={styles.buttons}>
          <button ref={cancelRef} type="button" data-testid="confirm-cancel" onClick={onCancel}>
            {vi.cancel}
          </button>
          <button
            type="button"
            className={styles.danger}
            data-testid="confirm-ok"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
