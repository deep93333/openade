import { registerCustomTheme } from "@pierre/diffs";

registerCustomTheme("dark-plus", () =>
  import("./themes/dark-plus.json").then((m) => m.default)
);
registerCustomTheme("agentide-dark", () =>
  import("./themes/agentide-dark.json").then((m) => m.default)
);
registerCustomTheme("agentide-light", () =>
  import("./themes/agentide-light.json").then((m) => m.default)
);
