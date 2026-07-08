"use client";

import * as React from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Heading1,
  Heading2,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
} from "lucide-react";

import { cn, fileToImageDataUrl } from "@/lib/utils";

async function insertImageFile(editor: Editor, file: File) {
  if (!file.type.startsWith("image/")) return;
  try {
    const src = await fileToImageDataUrl(file);
    editor.chain().focus().setImage({ src }).run();
  } catch {
    /* ignore unreadable image */
  }
}

interface NoteEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

/** Notion-like rich text editor (TipTap) with image paste/drop + compression. */
export function NoteEditor({ content, onChange, placeholder }: NoteEditorProps) {
  const editor = useEditor({
    immediatelyRender: false, // required under Next's SSR
    extensions: [
      StarterKit,
      Image.configure({ allowBase64: true }),
      Placeholder.configure({
        placeholder: placeholder ?? "Write your note… (paste or drop images)",
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: "note-content min-h-[240px] px-3 py-3 focus:outline-none",
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        const images = files.filter((f) => f.type.startsWith("image/"));
        if (images.length === 0) return false;
        event.preventDefault();
        images.forEach((f) => editor && void insertImageFile(editor, f));
        return true;
      },
      handleDrop: (_view, event) => {
        const files = Array.from(
          (event as DragEvent).dataTransfer?.files ?? []
        );
        const images = files.filter((f) => f.type.startsWith("image/"));
        if (images.length === 0) return false;
        event.preventDefault();
        images.forEach((f) => editor && void insertImageFile(editor, f));
        return true;
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  const fileRef = React.useRef<HTMLInputElement>(null);

  if (!editor) {
    return (
      <div className="min-h-[240px] rounded-lg border border-input bg-transparent" />
    );
  }

  return (
    <div className="rounded-lg border border-input bg-transparent focus-within:ring-1 focus-within:ring-ring">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border p-1">
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="Bold"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="Italic"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          label="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton
          active={editor.isActive("heading", { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          label="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          label="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="Bullet list"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          label="Numbered list"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          label="Quote"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton
          active={false}
          onClick={() => fileRef.current?.click()}
          label="Insert image"
        >
          <ImagePlus className="h-4 w-4" />
        </ToolbarButton>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            Array.from(e.target.files ?? []).forEach(
              (f) => void insertImageFile(editor, f)
            );
            e.target.value = "";
          }}
        />
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "rounded p-1.5 transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-border" />;
}
