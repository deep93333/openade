import {
  CopyFilledIcon,
  InboxIcon,
  MoonIcon,
  SunIcon,
  TodayIcon,
  TrashIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const MenuExample = () => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row justify-center flex-wrap gap-4 w-full bg-base-background ring-[0.65px] ring-foreground/10 p-8 rounded-sm">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="default" size="sm">
              <InboxIcon /> Inbox
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem>
              <InboxIcon /> Inbox
            </DropdownMenuItem>
            <DropdownMenuItem>
              <TodayIcon /> Today
            </DropdownMenuItem>
            <DropdownMenuItem>
              <CopyFilledIcon /> Copy
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <TrashIcon /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="bordered" size="sm">
              <InboxIcon /> Inbox
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem>
              <InboxIcon /> Inbox
            </DropdownMenuItem>
            <DropdownMenuItem>
              <TodayIcon /> Today
            </DropdownMenuItem>
            <DropdownMenuItem>
              <CopyFilledIcon /> Copy
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <SunIcon /> Theme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>
                  <SunIcon /> Light
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <MoonIcon /> Dark
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem>
              <TrashIcon /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="default" size="sm">
              My Account
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Billing</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>Keyboard shortcuts</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Team</DropdownMenuItem>
            <DropdownMenuItem>Invite users</DropdownMenuItem>
            <DropdownMenuItem>New Team</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>GitHub</DropdownMenuItem>
            <DropdownMenuItem>Support</DropdownMenuItem>
            <DropdownMenuItem>API</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
