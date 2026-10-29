import { ComponentsContext, useComponentsContext, useDictionary } from "@blocknote/react";
import { isValidElement, useMemo, type ReactNode, type ComponentProps } from "react";
import { Text, Bold, Italic, Underline, Strikethrough, Code, Link, Plus, GripVertical, Pencil, ExternalLink, Unlink, type LucideIcon } from "lucide-react";

/** Replace presentation only; upstream buttons retain their editor and IME behavior. */
export function FolioEditorIcons({ children }: { children: ReactNode }) {
  const base = useComponentsContext()!;
  const dict = useDictionary();
  const components = useMemo(() => {
    const replaceIcon = (icon: ReactNode, Icon: LucideIcon) => {
      // AddBlockButton binds its click to the icon itself. Keep its handlers and markers.
      const original = isValidElement(icon) ? icon.props as ComponentProps<LucideIcon> : {};
      return <Icon {...original} size={18} aria-hidden="true" focusable="false" />;
    };
    const styles: Record<string, LucideIcon> = { bold: Bold, italic: Italic, underline: Underline, strike: Strikethrough, code: Code, createLink: Link };
    const FormattingButton: typeof base.FormattingToolbar.Button = (props) => {
      const key = (props as typeof props & { "data-test"?: string })["data-test"] ?? "";
      const Icon = styles[key];
      return <base.FormattingToolbar.Button {...props} icon={Icon ? replaceIcon(props.icon, Icon) : props.icon} />;
    };
    const SideButton: typeof base.SideMenu.Button = (props) => <base.SideMenu.Button {...props} icon={replaceIcon(props.icon, props.label === dict.side_menu.add_block_label ? Plus : GripVertical)} />;
    const LinkButton: typeof base.LinkToolbar.Button = (props) => {
      const label = props.label ?? props.mainTooltip;
      const Icon = label === dict.link_toolbar.edit.tooltip ? Pencil : label === dict.link_toolbar.open.tooltip ? ExternalLink : Unlink;
      const icon = replaceIcon(props.icon, Icon);
      // Mantine renders children instead of icon for the text-bearing Edit button.
      if (props.children !== undefined) return <base.LinkToolbar.Button {...props}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{icon}{props.children}</span></base.LinkToolbar.Button>;
      return <base.LinkToolbar.Button {...props} icon={icon} />;
    };
    const TextInput: typeof base.Generic.Form.TextInput = (props) => <base.Generic.Form.TextInput {...props} icon={props.icon ? replaceIcon(props.icon, props.name === "url" ? Link : Text) : undefined} />;
    return { ...base, Generic: { ...base.Generic, Form: { ...base.Generic.Form, TextInput } }, FormattingToolbar: { ...base.FormattingToolbar, Button: FormattingButton }, SideMenu: { ...base.SideMenu, Button: SideButton }, LinkToolbar: { ...base.LinkToolbar, Button: LinkButton } };
  }, [base, dict]);
  return <ComponentsContext.Provider value={components}>{children}</ComponentsContext.Provider>;
}
