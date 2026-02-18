import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useId } from "react";

export const DialogExample = () => {
  const nameId = useId();
  const usernameId = useId();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row justify-center flex-wrap gap-4 w-full bg-base-background ring-[0.65px] ring-foreground/10 p-8 rounded-sm">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="default" size="sm">
              Open Dialog
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Are you absolutely sure?</DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete your account and remove
                your data from our servers.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="bordered" size="sm">
                Cancel
              </Button>
              <Button variant="destructive" size="sm">
                Continue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="bordered" size="sm">
              Settings Dialog
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Settings</DialogTitle>
              <DialogDescription>
                Make changes to your profile here. Click save when you're done.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor={nameId} className="text-right">
                  Name
                </label>
                <input
                  id={nameId}
                  defaultValue="Pedro Duarte"
                  className="col-span-3 px-3 py-2 border border-input rounded-md"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor={usernameId} className="text-right">
                  Username
                </label>
                <input
                  id={usernameId}
                  defaultValue="@peduarte"
                  className="col-span-3 px-3 py-2 border border-input rounded-md"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="bordered" size="sm">
                Cancel
              </Button>
              <Button size="sm">Save changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm">Confirmation</Button>
          </DialogTrigger>
          <DialogContent className="!max-w-sm">
            <DialogHeader>
              <DialogTitle>Confirm Action</DialogTitle>
              <DialogDescription>
                Are you sure you want to proceed with this action? This will affect your current
                session.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
              <Button size="sm">Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
