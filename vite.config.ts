import { cloudflare } from "@cloudflare/vite-plugin";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import ssrPlugin from "vite-ssr-components/plugin";
import { inertiaPages } from "@hono/inertia/vite";

export default defineConfig({
  plugins: [inertiaPages({ extensions: ["vue"] }), vue(), cloudflare(), ssrPlugin()],
  // @vitejs/plugin-vue's legacy `ssr` config option makes Vite spawn a phantom
  // default "ssr" environment alongside the named Cloudflare worker environment;
  // give it a real entry so vite-ssr-components' build loop doesn't crash on it.
  environments: {
    ssr: {
      build: {
        // This phantom environment's own output is unused (see comment above) —
        // its outDir defaults to the shared "dist" root, so without this it empties
        // "dist" on its way in and wipes out the "client" environment's build
        // (Vue bundle, CSS, fonts) that already ran before it.
        emptyOutDir: false,
        rollupOptions: { input: "./app/server.ts" },
      },
    },
  },
});
