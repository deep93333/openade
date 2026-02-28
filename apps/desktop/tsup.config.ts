import path from "node:path";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    main: "src/main.ts",
    preload: "src/preload.ts",
    "preload-log": "src/preload-log.ts",
  },
  format: ["cjs"],
  outDir: "dist",
  external: ["electron", "node-pty"],
  target: "node18",
  clean: true,
  minify: false,
  splitting: false,
  sourcemap: false,
  dts: false,
  bundle: true,
  platform: "node",
  noExternal: ["@agentide/agent", "@agentide/shared"],
  esbuildOptions(options) {
    options.platform = "node";
    options.external = [...(options.external || []), "electron", "node-pty"];
    options.alias = {
      "@": path.resolve(__dirname, "./src"),
    };
  },
});
