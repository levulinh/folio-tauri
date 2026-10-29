import { UploadTab, useDictionary, useComponentsContext, type FilePanelProps } from "@blocknote/react";
import { useState } from "react";

/** Imported images live in Folio; the editor never embeds a transient local-file URL. */
export function FolioImagePanel(props: FilePanelProps) {
  const dict = useDictionary();
  const [loading, setLoading] = useState(false);
  const Components = useComponentsContext()!;
  return <Components.FilePanel.Root className="bn-panel" loading={loading} defaultOpenTab={dict.file_panel.upload.title} openTab={dict.file_panel.upload.title} setOpenTab={() => {}} tabs={[{ name: dict.file_panel.upload.title, tabPanel: <fieldset disabled={loading} style={{ border: 0, margin: 0, padding: 0 }}><UploadTab {...props} setLoading={setLoading} /></fieldset> }]} />;
}
