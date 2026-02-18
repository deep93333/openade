export const TypographyExample = () => {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-8">
        <div className="flex flex-row gap-4">
          <p className="text-xs w-32 text-muted-foreground shrink-0">text-xs</p>
          <p className="text-xs text-muted-foreground">
            The quick brown fox jumps over the lazy dog. Perfect for small captions and labels.
          </p>
        </div>
        <div className="flex flex-row gap-4">
          <p className="text-xs w-32 text-muted-foreground shrink-0">text-sm</p>
          <p className="text-sm text-muted-foreground">
            The quick brown fox jumps over the lazy dog. Perfect for small captions and labels.
          </p>
        </div>
        <div className="flex flex-row gap-4">
          <p className="text-xs w-32 text-muted-foreground shrink-0">text-base</p>
          <p className="text-base text-muted-foreground">
            The quick brown fox jumps over the lazy dog. This is our base font size for body text.
          </p>
        </div>
        <div className="flex flex-row gap-4">
          <p className="text-xs w-32 text-muted-foreground shrink-0">text-lg</p>
          <p className="text-lg text-muted-foreground">
            The quick brown fox jumps over the lazy dog. Great for emphasized paragraphs.
          </p>
        </div>
        <div className="flex flex-row gap-4">
          <p className="text-xs w-32 text-muted-foreground shrink-0">text-xl</p>
          <p className="text-xl text-muted-foreground">
            The quick brown fox jumps over the lazy dog. Used for subheadings.
          </p>
        </div>
        <div className="flex flex-row gap-4">
          <p className="text-xs w-32 text-muted-foreground shrink-0">text-2xl</p>
          <p className="text-2xl text-muted-foreground">
            The quick brown fox jumps over the lazy dog. Section headers.
          </p>
        </div>
        <div className="flex flex-row gap-4">
          <p className="text-xs w-32 text-muted-foreground shrink-0">text-3xl</p>
          <p className="text-3xl text-muted-foreground">
            The quick brown fox jumps over the lazy dog. Main titles.
          </p>
        </div>
      </div>
    </div>
  );
};
