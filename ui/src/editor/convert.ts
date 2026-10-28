import type { Block, PartialBlock } from "@blocknote/core";
import type { BlockNode } from "../backend/generated/BlockNode";
import type { FolioEditor } from "./schema";

type FolioBlock = Block<FolioEditor["schema"]["blockSchema"], FolioEditor["schema"]["inlineContentSchema"], FolioEditor["schema"]["styleSchema"]>;
type FolioPartialBlock = PartialBlock<FolioEditor["schema"]["blockSchema"], FolioEditor["schema"]["inlineContentSchema"], FolioEditor["schema"]["styleSchema"]>;

/** Stored nodes → BlockNote initial content. Ids are kept: the save pipeline diffs on them. */
export function toEditorBlocks(nodes: BlockNode[]): FolioPartialBlock[] {
  return nodes.map(
    (n) =>
      ({
        id: n.id,
        type: n.type,
        props: n.props,
        content: n.content ?? undefined,
        children: toEditorBlocks(n.children),
      }) as FolioPartialBlock,
  );
}

/** BlockNote block → stored shape (drops `id` and `children`). */
export function toStored(block: FolioBlock): { type: string; props: Record<string, unknown>; content: unknown } {
  return {
    type: block.type,
    props: block.props as Record<string, unknown>,
    content: block.content ?? null,
  };
}
