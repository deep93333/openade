"use client";

import { useState } from "react";
import type { KeyboardEvent } from "react";
import { cn } from "../lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./command";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

type ComboboxItem = {
  value: string;
  label: string | React.ReactNode;
  icon?: React.ReactNode;
  keywords?: string[];
  onSelect?: () => void;
};

type ComboboxGroup = {
  heading?: string;
  items: ComboboxItem[];
  condition?: () => boolean;
};

type ComboboxProps = {
  groups: ComboboxGroup[];
  placeholder?: string;
  emptyMessage?: string;
  align?: "start" | "center" | "end";
  width?: string;
  onOpenChange?: (open: boolean) => void;
  contentContainerClassName?: string;
  contentClassName?: string;
  children?: React.ReactNode;
  modal?: boolean;
  isMultiSelect?: boolean;
};

export function Combobox({
  groups,
  placeholder = "Search...",
  emptyMessage = "No results found.",
  align = "start",
  width = "w-64",
  onOpenChange,
  contentClassName,
  isMultiSelect = false,
  contentContainerClassName,
  children,
  modal = false,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  const handleSelect = (item: ComboboxItem) => {
    item.onSelect?.();
    if (isMultiSelect) {
      return;
    }
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    handleOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={4}
        className={cn(
          width,
          "p-0 rounded-xl ",
          modal ? "z-combobox-modal" : "z-combobox",
          contentContainerClassName
        )}
      >
        <Command onKeyDown={handleKeyDown}>
          <CommandInput
            placeholder={placeholder}
            className="h-9 px-3 rounded-none bg-transparent shadow-none w-full border-b border-foreground/10"
          />
          <CommandList className={contentClassName}>
            <CommandEmpty>{emptyMessage}</CommandEmpty>

            {groups.map((group, groupIndex) => {
              const shouldShow = group.condition ? group.condition() : true;
              if (!shouldShow || group.items.length === 0) return null;

              return (
                <>
                  <CommandGroup key={groupIndex} heading={group.heading} className="p-1">
                    {group.items.map((item) => (
                      <CommandItem
                        key={item.value}
                        value={item.value}
                        keywords={item.keywords}
                        onSelect={() => handleSelect(item)}
                        className="flex items-center gap-2 rounded-lg"
                      >
                        {item.icon}
                        <span className="flex-1 truncate overflow-hidden">{item.label}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  {groupIndex < groups.length - 1 && <CommandSeparator />}
                </>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
