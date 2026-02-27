import React from "react";
import { ImageAttachment } from "@agentide/shared";
import { Button, XIcon } from "@agentide/ui";
import { createImagePreviewUrl } from "@/utils/image-attachment";
import { cn } from "@/lib/cn";

interface ImageAttachmentPreviewProps {
  attachment: ImageAttachment;
  onRemove?: (attachmentId: string) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const ImageAttachmentPreview: React.FC<ImageAttachmentPreviewProps> = ({
  attachment,
  onRemove,
  className,
  size = "md"
}) => {
  const previewUrl = createImagePreviewUrl(attachment);

  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-20 h-20",
    lg: "w-24 h-24"
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className={cn("relative group bg-background/50 rounded-lg border border-border overflow-hidden", className)}>
      <div className={cn("relative", sizeClasses[size])}>
        <img
          src={previewUrl}
          alt={attachment.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />

        {onRemove && (
          <Button
            size="icon-xs"
            variant="destructive"
            className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 rounded-full shadow-md"
            onClick={() => onRemove(attachment.id)}
            title="Remove image"
          >
            <XIcon className="h-3 w-3" />
          </Button>
        )}
      </div>

      <div className="p-2 space-y-1">
        <p className="text-xs font-medium text-foreground truncate" title={attachment.name}>
          {attachment.name}
        </p>
        <div className="flex justify-between items-center text-[10px] text-muted-foreground">
          <span className="truncate">{attachment.type}</span>
          <span>{formatFileSize(attachment.size)}</span>
        </div>
      </div>
    </div>
  );
};

interface ImageAttachmentListProps {
  attachments: ImageAttachment[];
  onRemove?: (attachmentId: string) => void;
  className?: string;
  maxDisplay?: number;
}

export const ImageAttachmentList: React.FC<ImageAttachmentListProps> = ({
  attachments,
  onRemove,
  className,
  maxDisplay = 4
}) => {
  if (attachments.length === 0) return null;

  const displayedAttachments = attachments.slice(0, maxDisplay);
  const remainingCount = attachments.length - maxDisplay;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {displayedAttachments.map((attachment) => (
        <ImageAttachmentPreview
          key={attachment.id}
          attachment={attachment}
          onRemove={onRemove}
          size="sm"
        />
      ))}

      {remainingCount > 0 && (
        <div className="w-16 h-16 bg-muted rounded-lg border border-dashed border-border flex items-center justify-center">
          <span className="text-xs text-muted-foreground font-medium">
            +{remainingCount}
          </span>
        </div>
      )}
    </div>
  );
};