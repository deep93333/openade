"use client";
import { AvatarImage } from "@radix-ui/react-avatar";
import * as React from "react";
import { CopyIcon, PencilIcon, RotateIcon } from "../icons";
import { cn } from "../lib/utils";
import { Avatar, AvatarFallback } from "./avatar";
import { Button } from "./button";

type ChatBubbleProps = {
  content: string;
  className?: string;
  avatarSrc?: string;
  avatarFallback?: string;
  maxLength?: number;
};

const ChatBubble = React.forwardRef<HTMLDivElement, ChatBubbleProps>(
  ({ content, className, avatarSrc, avatarFallback, maxLength = 200 }, ref) => {
    const [isExpanded, setIsExpanded] = React.useState(false);

    const shouldTruncate = content.length > maxLength;
    const displayContent =
      shouldTruncate && !isExpanded ? content.slice(0, maxLength) + "..." : content;

    return (
      <div className="w-full h-fit group flex-col flex justify-end items-end">
        <div className="flex flex-row gap-1 justify-end items-end pl-[20%]">
          <div
            ref={ref}
            className={cn(
              "bg-foreground/10 rounded-t-2xl rounded-bl-2xl rounded-br-md px-4 py-2",
              className
            )}
          >
            <div className="text-sm w-full opacity-90 text-foreground/90">
              {displayContent}
              {shouldTruncate && (
                <a
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-sm ml-1 cursor-pointer text-accent hover:text-accent-hover decoration-none text-xs font-medium"
                >
                  {isExpanded ? "Show less" : "Show more"}
                </a>
              )}
            </div>
          </div>
          {avatarSrc && avatarFallback && (
            <Avatar>
              <AvatarImage src={avatarSrc} alt="John Doe" />
              <AvatarFallback>{avatarFallback}</AvatarFallback>
            </Avatar>
          )}
        </div>

        <div
          className={cn(
            "flex flex-row gap-1 p-1 group-hover:opacity-100 opacity-0 transition-opacity duration-300",
            avatarSrc && avatarFallback && "mr-8"
          )}
        >
          <Button size="icon-sm" variant="ghost" rounded="full" tooltip="Copy" tooltipSide="bottom">
            <CopyIcon />
          </Button>
          <Button size="icon-sm" variant="ghost" rounded="full" tooltip="Edit" tooltipSide="bottom">
            <PencilIcon />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            rounded="full"
            tooltip="Rotate"
            tooltipSide="bottom"
          >
            <RotateIcon />
          </Button>
        </div>
      </div>
    );
  }
);

ChatBubble.displayName = "ChatBubble";

export { ChatBubble };
