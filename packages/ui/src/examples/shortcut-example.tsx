import { Shortcut } from "../components/shortcut";

export const ShortcutExample = () => {
  return (
    <div className="space-y-6 flex flex-col gap-4 w-full">
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Command + R:</span>
        <Shortcut shortcut="command+r" />
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Command + Shift + R:</span>
        <Shortcut shortcut="command+shift+r" />
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Command + Option + K:</span>
        <Shortcut shortcut="command+option+k" />
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Control + C:</span>
        <Shortcut shortcut="control+c" />
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Command + Shift + P:</span>
        <Shortcut shortcut="cmd+shift+p" />
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Alt + Tab:</span>
        <Shortcut shortcut="alt+tab" />
      </div>
    </div>
  );
};
