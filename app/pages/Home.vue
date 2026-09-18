<script setup lang="ts">
import Layout from "./Layout.vue";

type ParsedStatus = "ok" | "unstable" | "error" | "unknown";

defineProps<{
  url: string;
  version: string;
  pageStatusLabel: string;
  services: { domain: string; label: string | null; days: ParsedStatus[] }[];
}>();
</script>

<template>
  <Layout title="Status" :url="url" :version="version">
    <p class="page-status">{{ pageStatusLabel }}</p>

    <div class="services">
      <div v-for="service in services" :key="service.domain" class="service">
        <p class="name">{{ service.label ?? service.domain }}</p>
        <p class="domain">DOMAIN: {{ service.domain }}</p>
        <div class="history">
          <div v-for="(day, i) in service.days" :key="i" :class="['day', day]"></div>
        </div>
      </div>
      <p v-if="services.length === 0" class="empty">There are no services registered.</p>
    </div>
  </Layout>
</template>

<style scoped>
.page-status {
  text-align: center;
  font-family: var(--font-title);
  font-size: 30px;
  font-weight: 600;
  margin: 8px 0 24px;
}

.services {
  overflow: hidden;
  border-radius: 25px;
  background: var(--card-bg);
  width: 90%;
  margin: 16px auto;
}

.service {
  width: 95%;
  margin: 4px auto 10px auto;
}

.service .name {
  font-family: var(--font-display);
  font-size: 24px;
  margin: 8px 0 0;
}

.service .domain {
  margin: 0 0 8px;
}

.history {
  display: grid;
  grid-template-columns: repeat(90, 1fr);
  gap: 1px;
}

.history .day {
  height: 28px;
}

.history .day.ok {
  background: rgb(37, 255, 164);
}

.history .day.unstable {
  background: yellow;
}

.history .day.error {
  background: red;
}

.history .day.unknown {
  background: rgb(80, 80, 80);
}

.empty {
  text-align: center;
  color: var(--muted);
  padding: 10px 0;
}
</style>
