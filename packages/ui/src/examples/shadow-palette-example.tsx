export const ShadowPaletteExample = () => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row flex-wrap gap-4">
        <div className="flex flex-col gap-2 flex-wrap">
          <div className="w-32 h-24 rounded-lg shadow-sm bg-white"></div>
          <p className="text-xs text-muted-foreground">shadow-sm</p>
        </div>
        <div className="flex flex-col gap-2 flex-wrap">
          <div className="w-32 h-24 rounded-lg shadow-md bg-white"></div>
          <p className="text-xs text-muted-foreground">shadow-md</p>
        </div>
        <div className="flex flex-col gap-2 flex-wrap">
          <div className="w-32 h-24 rounded-lg shadow-lg bg-white"></div>
          <p className="text-xs text-muted-foreground">shadow-lg</p>
        </div>
        <div className="flex flex-col gap-2 flex-wrap">
          <div className="w-32 h-24 rounded-lg shadow-xl bg-white"></div>
          <p className="text-xs text-muted-foreground">shadow-xl</p>
        </div>
      </div>
      <div className="flex flex-row flex-wrap gap-4">
        <div className="flex flex-col gap-2 flex-wrap">
          <div className="w-32 h-24 rounded-lg ring-shadow shadow-sm bg-white"></div>
          <p className="text-xs text-muted-foreground">shadow-sm</p>
        </div>
        <div className="flex flex-col gap-2 flex-wrap">
          <div className="w-32 h-24 rounded-lg ring-shadow shadow-md bg-white"></div>
          <p className="text-xs text-muted-foreground">shadow-md</p>
        </div>
        <div className="flex flex-col gap-2 flex-wrap">
          <div className="w-32 h-24 rounded-lg ring-shadow shadow-lg bg-white"></div>
          <p className="text-xs text-muted-foreground">shadow-lg</p>
        </div>
        <div className="flex flex-col gap-2 flex-wrap">
          <div className="w-32 h-24 rounded-lg ring-shadow shadow-xl bg-white"></div>
          <p className="text-xs text-muted-foreground">shadow-xl</p>
        </div>
      </div>
    </div>
  );
};
