export const ColorPaletteExample = () => {
  return (
    <div className="flex flex-col gap-4">
      {/* Base colors */}
      <div className="flex flex-row gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="w-32 h-24 rounded-sm bg-base-background"></div>
          <p className="text-xs text-muted-foreground">base-background</p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="w-32 h-24 rounded-sm bg-background"></div>
          <p className="text-xs text-muted-foreground">background</p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="w-32 h-24 rounded-sm bg-foreground"></div>
          <p className="text-xs text-muted-foreground">foreground</p>
        </div>
      </div>

      {/* Primary colors */}
      <div className="flex flex-row gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="w-32 h-24 rounded-sm bg-primary"></div>
          <p className="text-xs text-muted-foreground">primary</p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="w-32 h-24 rounded-sm bg-primary-foreground"></div>
          <p className="text-xs text-muted-foreground">primary-foreground</p>
        </div>
      </div>

      {/* Secondary colors */}
      <div className="flex flex-row gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="w-32 h-24 rounded-sm bg-secondary"></div>
          <p className="text-xs text-muted-foreground">secondary</p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="w-32 h-24 rounded-sm bg-tertiary"></div>
          <p className="text-xs text-muted-foreground">tertiary</p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="w-32 h-24 rounded-sm bg-quaternary"></div>
          <p className="text-xs text-muted-foreground">quaternary</p>
        </div>
      </div>

      {/* Accent colors */}
      <div className="flex flex-row gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="w-32 h-24 rounded-sm bg-accent"></div>
          <p className="text-xs text-muted-foreground">accent</p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="w-32 h-24 rounded-sm bg-accent-hover"></div>
          <p className="text-xs text-muted-foreground">accent-hover</p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="w-32 h-24 rounded-sm bg-accent-shadow"></div>
          <p className="text-xs text-muted-foreground">accent-shadow</p>
        </div>
      </div>

      {/* UI colors */}
      <div className="flex flex-row gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="w-32 h-24 rounded-sm bg-popover"></div>
          <p className="text-xs text-muted-foreground">popover</p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="w-32 h-24 rounded-sm bg-card"></div>
          <p className="text-xs text-muted-foreground">card</p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="w-32 h-24 rounded-sm bg-border"></div>
          <p className="text-xs text-muted-foreground">border</p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="w-32 h-24 rounded-sm bg-input"></div>
          <p className="text-xs text-muted-foreground">input</p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="w-32 h-24 rounded-sm bg-ring"></div>
          <p className="text-xs text-muted-foreground">ring</p>
        </div>
      </div>

      {/* Muted colors */}
      <div className="flex flex-row gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="w-32 h-24 rounded-sm bg-muted"></div>
          <p className="text-xs text-muted-foreground">muted</p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="w-32 h-24 rounded-sm bg-muted-foreground"></div>
          <p className="text-xs text-muted-foreground">muted-foreground</p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="w-32 h-24 rounded-sm bg-soft"></div>
          <p className="text-xs text-muted-foreground">soft</p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="w-32 h-24 rounded-sm bg-hard"></div>
          <p className="text-xs text-muted-foreground">hard</p>
        </div>
      </div>

      {/* Brand colors */}
      <div className="flex flex-row gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="w-32 h-24 rounded-sm bg-brand"></div>
          <p className="text-xs text-muted-foreground">brand</p>
        </div>
      </div>

      {/* Destructive colors */}
      <div className="flex flex-row gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="w-32 h-24 rounded-sm bg-destructive"></div>
          <p className="text-xs text-muted-foreground">destructive</p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="w-32 h-24 rounded-sm bg-destructive-hover"></div>
          <p className="text-xs text-muted-foreground">destructive-hover</p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="w-32 h-24 rounded-sm bg-destructive-shadow"></div>
          <p className="text-xs text-muted-foreground">destructive-shadow</p>
        </div>
      </div>
    </div>
  );
};
