import { registerCustomTheme } from "@pierre/diffs";

registerCustomTheme("dark-plus", () =>
  import("./themes/dark-plus.json").then((m) => m.default)
);
registerCustomTheme("openade-dark", () =>
  import("./themes/openade-dark.json").then((m) => m.default)
);
