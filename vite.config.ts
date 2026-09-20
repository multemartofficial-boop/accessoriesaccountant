// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { fileURLToPath } from "node:url";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      // Lets the nitro server entry bundle the Express API (single deploy).
      // tsc sees only the ambient stub in src/server-app.d.ts.
      alias: { "server-app": fileURLToPath(new URL("./server/src/app.ts", import.meta.url)) },
    },
    server: {
      // Dev proxy: /api/* → Express backend on :5000
      proxy: { "/api": { target: "http://localhost:5000", changeOrigin: true } },
    },
  },
});
