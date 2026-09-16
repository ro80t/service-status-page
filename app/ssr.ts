import { createInertiaApp } from "@inertiajs/vue3";
import { renderToString } from "@vue/server-renderer";
import { createSSRApp, h } from "vue";
import type { PageObject } from "@hono/inertia";
import type { Page } from "@inertiajs/core";

const pages = import.meta.glob("./pages/**/*.vue", { eager: true });

export const renderPage = (page: PageObject) =>
  createInertiaApp({
    page: page as Page,
    render: renderToString,
    resolve: (name) => pages[`./pages/${name}.vue`] as never,
    setup({ App, props, plugin }) {
      return createSSRApp({ render: () => h(App, props) }).use(plugin);
    },
  });
