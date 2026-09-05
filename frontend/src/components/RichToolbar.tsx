"use client";

import {
  Undo2,
  Redo2,
  Type,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  ListOrdered,
  List,
  Indent,
  Outdent,
  Quote,
  Code,
  Strikethrough,
} from "lucide-react";

interface RichToolbarProps {
  editorRef: React.RefObject<HTMLDivElement>;
}

function ToolbarButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // keep editor selection focused
      onClick={onClick}
      className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
    >
      {children}
    </button>
  );
}

export function RichToolbar({ editorRef }: RichToolbarProps) {
  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  }

  return (
    <div className="flex items-center gap-1 border-y border-slate-100 px-1 py-1.5 text-slate-500">
      <ToolbarButton onClick={() => exec("undo")}>
        <Undo2 size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => exec("redo")}>
        <Redo2 size={16} />
      </ToolbarButton>
      <div className="mx-1 h-4 w-px bg-slate-200" />
      <ToolbarButton onClick={() => exec("fontSize", "3")}>
        <Type size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => exec("bold")}>
        <Bold size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => exec("italic")}>
        <Italic size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => exec("underline")}>
        <Underline size={16} />
      </ToolbarButton>
      <div className="mx-1 h-4 w-px bg-slate-200" />
      <ToolbarButton onClick={() => exec("justifyLeft")}>
        <AlignLeft size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => exec("insertOrderedList")}>
        <ListOrdered size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => exec("insertUnorderedList")}>
        <List size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => exec("indent")}>
        <Indent size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => exec("outdent")}>
        <Outdent size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => exec("formatBlock", "blockquote")}>
        <Quote size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => exec("formatBlock", "pre")}>
        <Code size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => exec("strikeThrough")}>
        <Strikethrough size={16} />
      </ToolbarButton>
    </div>
  );
}
