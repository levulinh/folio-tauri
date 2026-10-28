import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey } from "prosemirror-state";

/**
 * Keeps the slash menu shut during IME composition (D-022). BlockNote's suggestion plugin opens
 * its menu from `handleTextInput` without looking at `view.composing`. This extension's plugin
 * runs first (`runsBefore`): while composing it inserts the text itself and reports it handled,
 * so the suggestion plugin never sees the `/`.
 */
export const slashComposingGuard = createExtension(() => ({
  key: "slashComposingGuard",
  runsBefore: ["suggestionMenu"],
  prosemirrorPlugins: [
    new Plugin({
      key: new PluginKey("folio-slash-composing-guard"),
      props: {
        handleTextInput(view, from, to, text) {
          if (!view.composing || !text.includes("/")) return false;
          view.dispatch(view.state.tr.insertText(text, from, to));
          return true;
        },
      },
    }),
  ],
}));
