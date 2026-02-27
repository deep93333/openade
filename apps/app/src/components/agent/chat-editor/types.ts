import type { Editor } from "@tiptap/react";
import type { ImageAttachment } from "@agentide/shared";

export type ModelOption = { value: string; label: string };

export type ThreadChangedFile = { path: string; added: number; deleted: number };

export type ActiveWorkspace = { name: string; path: string; branch?: string } | null;

export type ChatEditorProps = {
  placeholder: string;
  editable: boolean;
  editorRef: React.MutableRefObject<Editor | null>;
  submitRef: React.MutableRefObject<(text: string, html: string, imageAttachments?: ImageAttachment[]) => void>;
  onPromptChange: (text: string) => void;
  isRunning: boolean;
  canSubmit: boolean;
  onStop: () => void;
  onSubmit: () => void;
  embedded?: boolean;
  modelOptions?: ModelOption[];
  onModelChange?: (model: string) => void;
  onNewChat?: () => void;
  canNewChat?: boolean;
  activeWorkspace?: ActiveWorkspace;
  threadChangedFiles?: ThreadChangedFile[];
  onThreadChangedFileSelect?: (path: string) => void;
  imageAttachments?: ImageAttachment[];
  onImageAttachmentsChange?: (attachments: ImageAttachment[]) => void;
};
