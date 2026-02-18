import { CopyFilledIcon, InboxIcon, TodayIcon, TrashIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useId } from "react";

export const PopoverExample = () => {
  const widthId = useId();
  const maxWidthId = useId();
  const heightId = useId();
  const maxHeightId = useId();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row justify-center flex-wrap gap-4 w-full bg-base-background ring-[0.65px] ring-foreground/10 p-8 rounded-sm">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="default" size="sm">
              Open Popover
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="grid gap-4">
              <div className="space-y-1">
                <h4 className="font-medium text-base leading-none">Dimensions</h4>
                <p className="text-sm text-muted-foreground">Set the dimensions for the layer.</p>
              </div>
              <div className="grid gap-2">
                <div className="grid grid-cols-3 items-center gap-4">
                  <label htmlFor={widthId} className="text-sm font-medium">
                    Width
                  </label>
                  <input
                    id={widthId}
                    defaultValue="100%"
                    className="col-span-2 h-8 px-3 text-sm border border-input bg-background rounded-md"
                  />
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <label htmlFor={maxWidthId} className="text-sm font-medium">
                    Max. width
                  </label>
                  <input
                    id={maxWidthId}
                    defaultValue="300px"
                    className="col-span-2 h-8 px-3 text-sm border border-input bg-background rounded-md"
                  />
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <label htmlFor={heightId} className="text-sm font-medium">
                    Height
                  </label>
                  <input
                    id={heightId}
                    defaultValue="25px"
                    className="col-span-2 h-8 px-3 text-sm border border-input bg-background rounded-md"
                  />
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <label htmlFor={maxHeightId} className="text-sm font-medium">
                    Max. height
                  </label>
                  <input
                    id={maxHeightId}
                    defaultValue="none"
                    className="col-span-2 h-8 px-3 text-sm border border-input bg-background rounded-md"
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm">Settings</Button>
          </PopoverTrigger>
          <PopoverContent className="w-72">
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="font-medium text-base leading-none">Settings</h4>
                <p className="text-sm text-muted-foreground">
                  Manage your preferences and configurations.
                </p>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="bordered" size="sm">
              Quick Actions
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56">
            <div className="space-y-1">
              <div className="space-y-2">
                <h4 className="font-medium text-base leading-none">Quick Actions</h4>
                <p className="text-sm text-muted-foreground">Common actions and shortcuts.</p>
              </div>
              <div className="space-y-1">
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  <CopyFilledIcon />
                  Copy Link
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  <InboxIcon />
                  Move to Inbox
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  <TodayIcon />
                  Schedule
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start text-destructive">
                  <TrashIcon />
                  Delete
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
