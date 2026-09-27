import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {resolve} from "node:path";

export default defineConfig({
  plugins: [
    react({jsxRuntime: "classic"}),
    {
      name: "ddp-local-monaco-workers",
      enforce: "pre",
      transform(code, id) {
        const modulePath = id.replaceAll("\\", "/");
        const environmentAccess = (modulePath.endsWith("/monaco-editor/esm/vs/common/workers.js")
          || modulePath.endsWith("/monaco-editor/esm/vs/editor/internal/initialize.js"))
          ? "const monacoEnvironment = globalThis.MonacoEnvironment;"
          : (modulePath.endsWith("/monaco-editor/esm/vs/base/browser/webWorkerFactory.js")
            || modulePath.endsWith("/monaco-editor/esm/vs/editor/editor.api2.js"))
            ? "const monacoEnvironment = getMonacoEnvironment();" : null;
        if (environmentAccess) {
          if (!code.includes(environmentAccess)) throw new Error("Monaco worker environment changed; review the private integration.");
          // This ESM copy must not publish global APIs or configure a host AMD loader.
          if (modulePath.endsWith("/editor.api2.js")) code = code.replace("const globalWithAMD = globalThis;", "const globalWithAMD = {};");
          const environmentModule = resolve(import.meta.dirname, "frontend/src/monacoEnvironment.js").replaceAll("\\", "/");
          return {
            code: `import ddpMonacoEnvironment from ${JSON.stringify(environmentModule)};\n${code.replaceAll(environmentAccess, "const monacoEnvironment = ddpMonacoEnvironment;")}`,
            map: null,
          };
        }
        if (!modulePath.endsWith("/monaco-editor/esm/vs/language/json/workerManager.js")) return;
        // Monaco 0.55 also embeds a native module-worker factory. Inline it for
        // Dash's single IIFE distribution, which has no import.meta.url base.
        const factory = /new Worker\(new URL\('json\.worker\.js', import\.meta\.url\), \{ type: "module" \}\)/;
        if (!factory.test(code)) throw new Error("Monaco JSON worker factory changed; review the inline integration.");
        return {
          code: `import DdpJsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker&inline';\n${code.replace(factory, "new DdpJsonWorker()")}`,
          map: null,
        };
      },
    },
  ],
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
