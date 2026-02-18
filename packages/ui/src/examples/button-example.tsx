import { Button } from "@/components/ui/button";

export const ButtonExample = () => {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-row  justify-center items-center flex-wrap gap-4 w-full bg-background ring-[0.65px] ring-foreground/10 p-8 rounded-sm">
        <Button variant="default" size="sm" shortcut="command+n">
          Small Button
        </Button>
        <Button variant="default" size="default">
          Default Button
        </Button>

        <Button variant="default" size="lg">
          Large Button
        </Button>
      </div>
      <div className="flex flex-row  justify-center items-center flex-wrap gap-4 w-full bg-background ring-[0.65px] ring-foreground/10 p-8 rounded-sm">
        <Button size="sm">Small Button</Button>
        <Button size="default">Default Button</Button>

        <Button size="lg" shortcut="command+R">
          Large Button
        </Button>
      </div>
      <div className="flex flex-row  justify-center items-center flex-wrap gap-4 w-full bg-background ring-[0.65px] ring-foreground/10 p-8 rounded-sm">
        <Button variant="bordered" size="sm">
          Small Button
        </Button>
        <Button variant="bordered" size="default">
          Default Button
        </Button>

        <Button variant="bordered" size="lg" shortcut="command+shift+R">
          Large Button
        </Button>
      </div>
      <div className="flex flex-row  justify-center items-center flex-wrap gap-4 w-full bg-background ring-[0.65px] ring-foreground/10 p-8 rounded-sm">
        <Button variant="ghost" size="sm">
          Small Button
        </Button>
        <Button variant="ghost" size="default">
          Default Button
        </Button>

        <Button variant="ghost" size="lg">
          Large Button
        </Button>
      </div>

      <div className="flex flex-row  justify-center items-center flex-wrap gap-4 w-full bg-background ring-[0.65px] ring-foreground/10 p-8 rounded-sm">
        <Button variant="secondary" size="sm">
          Small Button
        </Button>
        <Button variant="secondary" size="default" shortcut="command+shift+P">
          Default Button
        </Button>

        <Button variant="secondary" size="lg">
          Large Button
        </Button>
      </div>

      <div className="flex flex-row  justify-center items-center flex-wrap gap-4 w-full bg-background ring-[0.65px] ring-foreground/10 p-8 rounded-sm">
        <Button size="sm" loading shortcut="command+shift+P">
          Small Button
        </Button>
        <Button size="default" loading>
          Default Button
        </Button>

        <Button size="lg" loading>
          Large Button
        </Button>
      </div>
      <div className="flex flex-row  justify-center items-center flex-wrap gap-4 w-full bg-background ring-[0.65px] ring-foreground/10 p-8 rounded-sm">
        <Button variant="destructive" size="sm">
          Small Button
        </Button>
        <Button variant="destructive" size="default">
          Default Button
        </Button>

        <Button variant="destructive" size="lg">
          Large Button
        </Button>
      </div>

      <div className="flex flex-row  justify-center items-center flex-wrap gap-4 w-full bg-background ring-[0.65px] ring-foreground/10 p-8 rounded-sm">
        <Button variant="bordered" rounded="full" size="sm" shortcut="command+shift+P">
          Small Button
        </Button>
        <Button variant="bordered" rounded="full" size="default">
          Default Button
        </Button>

        <Button variant="bordered" rounded="full" size="lg">
          Large Button
        </Button>
      </div>
    </div>
  );
};
