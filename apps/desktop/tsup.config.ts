import path from "node:path";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    main: "src/main.ts",
    preload: "src/preload.ts",
  },
  format: ["cjs"],
  outDir: "dist",
  external: ["electron"],
  target: "node18",
  clean: true,
  minify: false,
  splitting: false,
  sourcemap: false,
  dts: false,
  bundle: true,
  platform: "node",
  esbuildOptions(options) {
    options.platform = "node";
    options.external = [...(options.external || []), "electron"];
    options.alias = {
      "@": path.resolve(__dirname, "./src"),
    };
  },
});
