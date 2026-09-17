<script setup lang="ts">
import Layout from "./Layout.vue";

defineProps<{ url: string; version: string }>();
</script>

<template>
  <Layout title="Page Not Found" :url="url" :version="version">
    <p class="code">404</p>
    <p class="message">Page not found.</p>
  </Layout>
</template>

<style scoped>
.code {
  text-align: center;
  font-family: var(--font-display);
  font-size: 64px;
  margin: 32px 0 8px;
}

.message {
  text-align: center;
  color: var(--muted);
}
</style>
