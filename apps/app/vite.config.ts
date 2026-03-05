import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const isElectron = process.env.ELECTRON === "true";

  return {
    plugins: [react(), tailwindcss()],
    base: mode === "development" ? "/" : isElectron ? "./" : "./",
    resolve: {
      alias: {
        "@": resolve("src"),
      },
      dedupe: ["react", "react-dom"],
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        external: isElectron
          ? ["electron", "fs", "fs/promises", "path", "crypto", "os", "events", "util", "stream"]
          : [],
        output: {
          assetFileNames: isElectron ? "[name][extname]" : "assets/[name].[hash][extname]",
          chunkFileNames: isElectron ? "[name].js" : "assets/[name].[hash].js",
          entryFileNames: isElectron ? "[name].js" : "assets/[name].[hash].js",
        },
        input: {
          main: resolve(__dirname, "index.html"),
        },
      },
    },
  };
});
