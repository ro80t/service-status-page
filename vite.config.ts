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
        rollupOptions: { input: "./app/server.ts" },
      },
    },
  },
});
