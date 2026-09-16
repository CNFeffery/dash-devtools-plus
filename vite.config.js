import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {resolve} from "node:path";

export default defineConfig({
  plugins: [react({jsxRuntime: "classic"})],
  resolve: {
    alias: [
      {
        find: /^react-dom(?:\/client)?$/,
        replacement: resolve(import.meta.dirname, "frontend/src/react-dom-bridge.js"),
      },
      {
        find: /^react\/jsx-(dev-)?runtime$/,
        replacement: resolve(import.meta.dirname, "frontend/src/react-jsx-runtime.js"),
      },
    ],
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    lib: {
      entry: resolve(import.meta.dirname, "frontend/src/index.jsx"),
      name: "DashDevtoolsPlusBundle",
      formats: ["iife"],
      fileName: () => "dash_devtools_plus.js",
    },
    outDir: "dash_devtools_plus/assets",
    emptyOutDir: false,
    cssCodeSplit: false,
    sourcemap: false,
    minify: "oxc",
    rollupOptions: {
      external: ["react"],
      output: {
        globals: {
          react: "React",
        },
        assetFileNames: (assetInfo) =>
          assetInfo.name?.endsWith(".css")
            ? "dash_devtools_plus.css"
            : "[name][extname]",
      },
    },
  },
});
