const DV = "text-[15px] mr-1.5 shrink-0 inline-block leading-none";
const SV = "size-4 mr-1.5 shrink-0";

const ICON_COLOR =
  "rgba(255, 255, 255, 0.95)";

export function FolderIcon({ name, open }: { name: string; open?: boolean }) {
  return (
    <svg className="size-4 mr-1.5 shrink-0" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      {open ? (
        <>
          <path
            d="M1.5 5.5A1 1 0 012.5 4.5H6l1 1.5h6.5a1 1 0 011 1v.5H2L1.5 5.5z"
            fill={ICON_COLOR}
            fillOpacity="0.55"
          />
          <path
            d="M1.5 7.5h13l-1 5a1 1 0 01-1 .8H2.5a1 1 0 01-1-.8l-1-5z"
            fill={ICON_COLOR}
          />
        </>
      ) : (
        <path
          d="M2 4.5A1 1 0 013 3.5H6.5l1 1.5H13a1 1 0 011 1v5.5a1 1 0 01-1 1H3a1 1 0 01-1-1V4.5z"
          fill={ICON_COLOR}
        />
      )}
    </svg>
  );
}

function Dev({ name, style = "plain", color }: { name: string; style?: string; color: string }) {
  return <i className={`devicon-${name}-${style} ${DV}`} style={{ color }} />;
}

type SvgProps = { color: string; children: React.ReactNode };

function Svg({ color, children }: SvgProps) {
  return (
    <svg className={SV} viewBox="0 0 16 16" fill="none" style={{ color }} xmlns="http://www.w3.org/2000/svg">
      {children}
    </svg>
  );
}

function KeyIcon({ color }: { color: string }) {
  return (
    <Svg color={color}>
      <circle cx="6" cy="8" r="3" stroke="currentColor" strokeWidth="1" />
      <path d="M9 8h4M11 6v4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </Svg>
  );
}

function GearIcon({ color }: { color: string }) {
  return (
    <Svg color={color}>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1" />
      <path
        d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.5 3.5l1 1M11.5 11.5l1 1M12.5 3.5l-1 1M4.5 11.5l-1 1"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function TextIcon({ color }: { color: string }) {
  return (
    <Svg color={color}>
      <path d="M3 4h10M3 7.5h10M3 11h7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </Svg>
  );
}

function LogIcon({ color }: { color: string }) {
  return (
    <Svg color={color}>
      <path d="M3 3.5h10M3 6.5h6M3 9.5h8M3 12.5h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </Svg>
  );
}

function ImageIcon({ color }: { color: string }) {
  return (
    <Svg color={color}>
      <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1" />
      <circle cx="5.5" cy="6.5" r="1.5" fill="currentColor" />
      <path d="M2 11l3.5-3.5 3 3 2-2 3.5 3.5" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </Svg>
  );
}

function JsonIcon({ color }: { color: string }) {
  return (
    <Svg color={color}>
      <path
        d="M5.5 2.5C4.5 2.5 4 3 4 4v2c0 1-.5 1.5-1.5 1.5C3.5 7.5 4 8 4 9v2c0 1 .5 1.5 1.5 1.5M10.5 2.5c1 0 1.5.5 1.5 1.5v2c0 1 .5 1.5 1.5 1.5C12.5 7.5 12 8 12 9v2c0 1-.5 1.5-1.5 1.5"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function FileIcon({ color }: { color: string }) {
  return (
    <Svg color={color}>
      <path d="M4 2h5.5L13 5.5V13a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1" />
      <path d="M9 2v4h4" stroke="currentColor" strokeWidth="1" />
    </Svg>
  );
}

const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp"]);

export function getFileTypeIcon(name: string) {
  const lowerName = name.toLowerCase();

  if (lowerName.startsWith("vite.config")) {
    return <Dev name="vitejs" style="original" color={ICON_COLOR} />;
  }

  if (lowerName.startsWith("vitest.config") || lowerName.endsWith(".test.ts") || lowerName.endsWith(".test.tsx") || lowerName.endsWith(".spec.ts") || lowerName.endsWith(".spec.tsx")) {
    return <Dev name="vitest" style="original" color={ICON_COLOR} />;
  }

  if (lowerName === "tsconfig.json" || lowerName.startsWith("tsconfig.")) {
    return <Dev name="typescript" color={ICON_COLOR} />;
  }

  if (lowerName === "dockerfile" || lowerName === ".dockerignore") {
    return <Dev name="docker" color={ICON_COLOR} />;
  }

  if (lowerName.startsWith(".env")) {
    return <KeyIcon color={ICON_COLOR} />;
  }

  if (lowerName === "package.json") {
    return <Dev name="nodejs" color={ICON_COLOR} />;
  }

  if (lowerName === "bun.lock") {
    return <Dev name="bun" color={ICON_COLOR} />;
  }

  if (lowerName === "pnpm-lock.yaml") {
    return <Dev name="pnpm" color={ICON_COLOR} />;
  }

  if (lowerName === "yarn.lock") {
    return <Dev name="yarn" style="original" color={ICON_COLOR} />;
  }

  if (lowerName === "package-lock.json") {
    return <Dev name="npm" style="original" color={ICON_COLOR} />;
  }

  if (
    lowerName === ".gitignore" ||
    lowerName === ".gitattributes" ||
    lowerName === ".gitmodules" ||
    lowerName === ".git-blame-ignore-revs"
  ) {
    return <Dev name="git" color={ICON_COLOR} />;
  }

  const extension = lowerName.includes(".") ? lowerName.split(".").pop() ?? "" : "";

  switch (extension) {
    case "ts":
      return <Dev name="typescript" color={ICON_COLOR} />;
    case "tsx":
      return <Dev name="react" style="original" color={ICON_COLOR} />;
    case "js":
    case "mjs":
    case "cjs":
      return <Dev name="javascript" color={ICON_COLOR} />;
    case "jsx":
      return <Dev name="react" style="original" color={ICON_COLOR} />;
    case "py":
      return <Dev name="python" color={ICON_COLOR} />;
    case "go":
      return <Dev name="go" style="original" color={ICON_COLOR} />;
    case "rs":
      return <Dev name="rust" style="original" color={ICON_COLOR} />;
    case "java":
      return <Dev name="java" color={ICON_COLOR} />;
    case "kt":
      return <Dev name="kotlin" color={ICON_COLOR} />;
    case "swift":
      return <Dev name="swift" color={ICON_COLOR} />;
    case "php":
      return <Dev name="php" color={ICON_COLOR} />;
    case "rb":
      return <Dev name="ruby" color={ICON_COLOR} />;
    case "sh":
    case "bash":
    case "zsh":
      return <Dev name="bash" color={ICON_COLOR} />;
    case "html":
    case "htm":
      return <Dev name="html5" color={ICON_COLOR} />;
    case "css":
      return <Dev name="css3" color={ICON_COLOR} />;
    case "scss":
    case "sass":
      return <Dev name="sass" style="original" color={ICON_COLOR} />;
    case "less":
      return <Dev name="less" style="plain-wordmark" color={ICON_COLOR} />;
    case "json":
    case "jsonc":
      return <JsonIcon color={ICON_COLOR} />;
    case "yaml":
    case "yml":
      return <Dev name="yaml" color={ICON_COLOR} />;
    case "toml":
    case "ini":
      return <GearIcon color={ICON_COLOR} />;
    case "md":
    case "mdx":
      return <Dev name="markdown" style="original" color={ICON_COLOR} />;
    case "sql":
      return <Dev name="sqlite" color={ICON_COLOR} />;
    case "txt":
      return <TextIcon color={ICON_COLOR} />;
    case "log":
      return <LogIcon color={ICON_COLOR} />;
  }

  if (imageExtensions.has(extension)) {
    return <ImageIcon color={ICON_COLOR} />;
  }

  return <FileIcon color={ICON_COLOR} />;
}
