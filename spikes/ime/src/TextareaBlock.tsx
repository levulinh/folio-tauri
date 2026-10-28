import { useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";

// Custom block holding a plain <textarea>. IME rule: never push the text into
// block props while a composition is active; sync on compositionend.
export const textareaBlock = createReactBlockSpec(
  {
    type: "textareaBlock",
    propSchema: { source: { default: "" } },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const [text, setText] = useState<string>(block.props.source);
      const [isComposing, setIsComposing] = useState(false);

      const commit = (source: string) => {
        editor.updateBlock(block, { props: { source } });
      };

      return (
        <textarea
          rows={4}
          value={text}
          placeholder="Ô văn bản thuần (textarea)"
          style={{
            width: "100%",
            fontFamily: "ui-monospace, Menlo, monospace",
            boxSizing: "border-box",
          }}
          onChange={(e) => {
            const value = e.target.value;
            setText(value);
            if (!isComposing) commit(value);
          }}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={(e) => {
            setIsComposing(false);
            const value = e.currentTarget.value;
            setText(value);
            commit(value);
          }}
          // Keep ProseMirror from handling keys typed in the textarea.
          onKeyDown={(e) => e.stopPropagation()}
        />
      );
    },
  },
);
