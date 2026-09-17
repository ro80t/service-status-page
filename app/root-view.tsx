import { renderToString } from "hono/jsx/dom/server";
import { Link, Script, ViteClient } from "vite-ssr-components/hono";
import type { RootView } from "@hono/inertia";
import { renderPage } from "./ssr";

const Head = () => (
  <>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="/favicon.ico" />
    <ViteClient />
    <Link rel="stylesheet" href="/app/styles.css" />
    <Script src="/app/client.ts" />
  </>
);

export const rootView: RootView = async (page) => {
  const { head, body } = await renderPage(page);
  const headHtml = renderToString(<Head />) + head.join("");
  return `<!DOCTYPE html><html lang="en"><head>${headHtml}</head><body>${body}</body></html>`;
};
