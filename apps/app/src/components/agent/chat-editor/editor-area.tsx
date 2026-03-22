import type { Editor } from "@tiptap/react";
import { EditorContent } from "@tiptap/react";
import type { ImageAttachment } from "@openade/shared";
import { ImageIcon } from "@openade/ui";
import { ImageAttachmentList } from "../attachments";
import { cn } from "@/lib/cn";

type EditorAreaProps = {
  editor: Editor | null;
  embedded: boolean;
  imageAttachments: ImageAttachment[];
  onRemoveImage: (id: string) => void;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export const EditorArea = ({
  editor,
  embedded,
  imageAttachments,
  onRemoveImage,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onPaste,
  fileInputRef,
  onFileInputChange,
}: EditorAreaProps) => (
  <div
    className={cn(
      "relative w-full min-w-0 scrollbar-thin scrollbar-thumb-zinc-300",
      "focus-within:outline-none focus-within:ring-0 focus-within:border-zinc-300 cursor-text",
      "transition-colors duration-200",
      embedded ? "min-h-[44px] bg-transparent" : "rounded-xl border border-zinc-300 bg-white",
      isDragOver && "border-blue-400 bg-blue-50 dark:bg-blue-950/20"
    )}
    onClick={() => editor?.commands.focus()}
    onDragOver={onDragOver}
    onDragLeave={onDragLeave}
    onDrop={onDrop}
    onPaste={onPaste}
  >
    {imageAttachments.length > 0 && (
      <div className="px-2 pt-2">
        <ImageAttachmentList attachments={imageAttachments} onRemove={onRemoveImage} />
      </div>
    )}

    {editor && (
      <EditorContent
        editor={editor}
        className={cn(
          "[&_.tiptap]:min-h-[34px] [&_.tiptap]:px-2 [&_.tiptap]:py-2 [&_.tiptap]:text-sm [&_.tiptap]:text-foreground [&_.tiptap]:outline-none [&_.tiptap]:caret-accent [&_.tiptap]:cursor-text",
          "[&_.tiptap_.ProseMirror]:caret-accent [&_.tiptap_.ProseMirror]:cursor-text",
          "[&_.tiptap_.is-editor-empty:first-child::before]:text-muted-foreground [&_.tiptap_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_.is-editor-empty:first-child::before]:float-left [&_.tiptap_.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_.is-editor-empty:first-child::before]:h-0",
          imageAttachments.length > 0 && "[&_.tiptap]:pt-1"
        )}
      />
    )}

    {isDragOver && (
      <div className="absolute inset-0 flex items-center justify-center bg-blue-50/90 dark:bg-blue-950/30 rounded-xl border-2 border-dashed border-blue-400">
        <div className="text-center">
          <ImageIcon className="mx-auto h-8 w-8 text-blue-500 mb-2" />
          <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Drop images here to attach</p>
        </div>
      </div>
    )}

    <input
      ref={fileInputRef as React.RefObject<HTMLInputElement>}
      type="file"
      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
      multiple
      className="hidden"
      onChange={onFileInputChange}
    />
  </div>
);
