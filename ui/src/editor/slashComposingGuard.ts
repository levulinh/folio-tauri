import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey } from "prosemirror-state";

/**
 * Keeps the slash menu shut during IME composition (D-022). BlockNote's suggestion plugin opens
 * its menu from `handleTextInput` without looking at composition state. This extension's plugin
 * runs first (`runsBefore`): for a lone `/` that is composed (`view.composing`, or a transaction
 * ProseMirror tagged `"composition"` that is flushed after `compositionend`) it dispatches
 * ProseMirror's own default transaction and reports the input handled, so the suggestion
 * plugin never sees the `/`.
 */
export const slashComposingGuard = createExtension(() => ({
  key: "slashComposingGuard",
  runsBefore: ["suggestionMenu"],
  prosemirrorPlugins: [
    new Plugin({
      key: new PluginKey("folio-slash-composing-guard"),
      props: {
        handleTextInput(view, _from, _to, text, deflt) {
          if (text !== "/") return false;
          const tr = deflt();
          if (!view.composing && tr.getMeta("composition") == null) return false;
          view.dispatch(tr);
          return true;
        },
      },
    }),
  ],
}));
