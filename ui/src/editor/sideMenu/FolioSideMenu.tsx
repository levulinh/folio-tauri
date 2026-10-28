import { AddBlockButton, DragHandleButton, DragHandleMenu, RemoveBlockItem, SideMenu } from "@blocknote/react";
import { useCallback, useEffect, useRef } from "react";
import { vi } from "../../i18n/vi";

/** The drag-handle menu: Delete and nothing else (no colours, no table header toggles). */
function FolioDragHandleMenu() {
  // BlockNote's menu items forward no props, so the test id is set on the DOM node. The dropdown's
  // content only mounts while the menu is open, hence a ref callback rather than an effect.
  const mark = useCallback((node: HTMLSpanElement | null) => {
    node?.closest(".bn-drag-handle-menu")?.querySelector(".bn-menu-item")?.setAttribute("data-testid", "drag-menu-delete");
  }, []);
  return (
    <DragHandleMenu>
      <span ref={mark} style={{ display: "contents" }}>
        <RemoveBlockItem>{vi.delete}</RemoveBlockItem>
      </span>
    </DragHandleMenu>
  );
}

/** Hover handles in the left gutter: + (insert below, opens the slash menu) and the drag handle. */
export function FolioSideMenu() {
  const holder = useRef<HTMLSpanElement>(null);
  // The buttons forward no props either; BlockNote marks their icons with `data-test`.
  useEffect(() => {
    const node = holder.current?.closest(".bn-side-menu");
    node?.querySelector('[data-test="dragHandleAdd"]')?.closest("button")?.setAttribute("data-testid", "side-add");
    node?.querySelector('[data-test="dragHandle"]')?.closest("button")?.setAttribute("data-testid", "side-drag");
  });
  return (
    <SideMenu>
      <span ref={holder} style={{ display: "contents" }}>
        <AddBlockButton />
        <DragHandleButton dragHandleMenu={FolioDragHandleMenu} />
      </span>
    </SideMenu>
  );
}
