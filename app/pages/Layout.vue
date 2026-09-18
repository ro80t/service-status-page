<script setup lang="ts">
import { Head, Link } from "@inertiajs/vue3";

const SITE_NAME = "service-status-page";
const DEFAULT_DESCRIPTION =
  "Continuous uptime monitoring with automatic Cloudflare lockdown on outages.";

const props = withDefaults(
  defineProps<{
    title?: string;
    description?: string;
    url: string;
    version: string;
  }>(),
  {
    title: "Home",
    description: DEFAULT_DESCRIPTION,
  },
);

const fullTitle = `${props.title} / ${SITE_NAME}`;
</script>

<template>
  <Head>
    <title>{{ fullTitle }}</title>
    <meta name="description" :content="description" />
    <meta name="theme-color" content="#37b6e4" />
    <meta name="format-detection" content="telephone=no,email=no,address=no" />

    <meta property="og:type" content="website" />
    <meta property="og:url" :content="url" />
    <meta property="og:title" :content="fullTitle" />
    <meta property="og:description" :content="description" />
    <meta property="og:site_name" :content="SITE_NAME" />

    <meta name="twitter:card" content="summary_large_image" />
  </Head>

  <div class="app">
    <header>
      <nav>
        <Link href="/">{{ SITE_NAME }}</Link>
      </nav>
    </header>
    <main>
      <slot />
    </main>
    <footer>
      <p>
        Powered by
        <a href="https://github.com/ro80t/service-status-page" target="_blank" rel="noopener noreferrer"
          >{{ SITE_NAME }}@{{ version }}</a
        >
      </p>
    </footer>
  </div>
</template>
