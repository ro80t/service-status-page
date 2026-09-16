import { createInertiaApp } from "@inertiajs/vue3";
import { createSSRApp, h } from "vue";

createInertiaApp({
  resolve: (name) => {
    const pages = import.meta.glob("./pages/**/*.vue", { eager: true });
    return pages[`./pages/${name}.vue`] as never;
  },
  setup({ el, App, props, plugin }) {
    createSSRApp({ render: () => h(App, props) })
      .use(plugin)
      .mount(el);
  },
});
