import { useEffect } from "react";
import { useUiStore } from "../state/uiStore";
import styles from "./Toast.module.css";

const TOAST_MS = 5000;

function ToastItem({ id, text }: { id: string; text: string }) {
  const dismiss = useUiStore((s) => s.dismissToast);
  useEffect(() => {
    const timer = setTimeout(() => dismiss(id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [id, dismiss]);
  return (
    <div className={styles.toast} role="status" data-testid="toast" onClick={() => dismiss(id)}>
      {text}
    </div>
  );
}

export function Toasts() {
  const toasts = useUiStore((s) => s.toasts);
  return (
    <div className={styles.stack}>
      {toasts.map((t) => (
        <ToastItem key={t.id} id={t.id} text={t.text} />
      ))}
    </div>
  );
}
