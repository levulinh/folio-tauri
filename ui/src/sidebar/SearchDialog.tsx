import { backend } from "../backend";
import { useReducedMotion } from "@mantine/hooks";
import { Modal } from "@mantine/core";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SearchHit } from "../backend/generated/SearchHit";
import { vi } from "../i18n/vi";
import { SearchBox } from "./SearchBox";
import { openHit, SearchResults } from "./SearchResults";
import { useSearchResults } from "./useSearchResults";
import styles from "./SearchDialog.module.css";

function SearchContent({ onClose }: { onClose(): void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const composing = useRef(false);
  const { query: hitsQuery, hits, searchNow } = useSearchResults(query);
  useEffect(() => backend.onMenu("search", () => { if (!composing.current) inputRef.current?.focus(); }), []);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  // Invalidate an in-flight Enter when the dialog closes, including during exit animation.
  const close = () => { alive.current = false; onClose(); };
  const select = (hit: SearchHit) => { if (!alive.current) return; openHit(hit); close(); };
  return <div data-testid="search-dialog" className={styles.inner} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onKeyDown={(e) => { if (e.key === "Escape" && !e.defaultPrevented && !composing.current && !e.nativeEvent.isComposing && e.keyCode !== 229) { e.preventDefault(); close(); } }}>
    <div className={styles.header}>
      <SearchBox inputRef={inputRef} onQueryChange={setQuery} onEscape={close} onEnter={() => {
        if (!query.trim()) return;
        if (hitsQuery === query && hits) { if (hits[0]) select(hits[0]); return; }
        void searchNow(query).then((found) => { if (found?.[0] && inputRef.current?.isConnected) select(found[0]); });
      }} />
      <button type="button" className={styles.close} aria-label="Đóng tìm kiếm" onClick={close}><X size={18} aria-hidden="true" /></button>
    </div>
    <div className={styles.results} aria-live="polite">
      {!query.trim() ? <p className={styles.hint}>Tìm trang hoặc nội dung ghi chú</p> : <SearchResults hits={hits} stale={hitsQuery !== query} onSelect={select} />}
    </div>
    <div className={styles.footer}><span>Enter để mở kết quả đầu tiên</span><span>Esc để đóng</span></div>
  </div>;
}

export function SearchDialog({ opened, onClose, restoreFocus }: { opened: boolean; onClose(): void; restoreFocus(): void }) {
  const reduceMotion = useReducedMotion();
  return <Modal opened={opened} onClose={onClose} title={vi.searchPlaceholder} size={600} yOffset="16vh"
    withCloseButton={false} closeOnEscape={false} returnFocus={false} onExitTransitionEnd={restoreFocus}
    transitionProps={{ transition: "pop", duration: reduceMotion ? 0 : 160 }} overlayProps={{ backgroundOpacity: 0.18, blur: 3 }}
    classNames={{ content: styles.content, header: styles.hiddenHeader, body: styles.body }}>
    {opened && <SearchContent onClose={onClose} />}
  </Modal>;
}
