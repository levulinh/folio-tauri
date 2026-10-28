import { useComponentsContext, type DefaultReactSuggestionItem, type SuggestionMenuProps } from "@blocknote/react";
import type { FolioSlashItem } from "./slashMenu";

/**
 * BlockNote's own suggestion-menu primitives (Mantine-styled), each item wrapped in a div that
 * carries the test ids: the primitives reject extra props. The wrapper has no styling of its own.
 */
export function SlashMenuComponent({ items, selectedIndex, onItemClick }: SuggestionMenuProps<DefaultReactSuggestionItem>) {
  const Components = useComponentsContext()!;
  return (
    <div data-testid="slash-menu">
      <Components.SuggestionMenu.Root id="bn-suggestion-menu" className="bn-suggestion-menu">
        {(items as FolioSlashItem[]).map((item, i) => (
          <div key={item.key} data-testid="slash-item" data-key={item.key}>
            <Components.SuggestionMenu.Item
              className="bn-suggestion-menu-item"
              item={item}
              id={`bn-suggestion-menu-item-${i}`}
              isSelected={i === selectedIndex}
              onClick={() => onItemClick?.(item)}
            />
          </div>
        ))}
      </Components.SuggestionMenu.Root>
    </div>
  );
}
