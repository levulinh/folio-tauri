import { useComponentsContext, useDictionary, type DefaultReactSuggestionItem, type SuggestionMenuProps } from "@blocknote/react";
import type { FolioSlashItem } from "./slashMenu";

/**
 * BlockNote's own suggestion-menu primitives (Mantine-styled), each item wrapped in a div that
 * carries the test ids: the primitives reject extra props. The wrappers have no styling and `role="none"`,
 * so the listbox/option structure stays intact for assistive tech.
 */
export function SlashMenuComponent({ items, loadingState, selectedIndex, onItemClick }: SuggestionMenuProps<DefaultReactSuggestionItem>) {
  const Components = useComponentsContext()!;
  const dict = useDictionary();
  return (
    <div role="none" data-testid="slash-menu">
      <Components.SuggestionMenu.Root id="bn-suggestion-menu" className="bn-suggestion-menu folio-slash-menu">
        {(items as FolioSlashItem[]).map((item, i) => (
          <div key={item.key} role="none" data-testid="slash-item" data-key={item.key}>
            <Components.SuggestionMenu.Item
              className="bn-suggestion-menu-item"
              item={{ ...item, size: "small" }}
              id={`bn-suggestion-menu-item-${i}`}
              isSelected={i === selectedIndex}
              onClick={() => onItemClick?.(item)}
            />
          </div>
        ))}
        {items.length === 0 && loadingState !== "loading-initial" && (
          <Components.SuggestionMenu.EmptyItem className="bn-suggestion-menu-item">
            {dict.suggestion_menu.no_items_title}
          </Components.SuggestionMenu.EmptyItem>
        )}
        {(loadingState === "loading-initial" || loadingState === "loading") && (
          <Components.SuggestionMenu.Loader className="bn-suggestion-menu-loader" />
        )}
      </Components.SuggestionMenu.Root>
    </div>
  );
}
