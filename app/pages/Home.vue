<script setup lang="ts">
import { Head } from "@inertiajs/vue3";
import Layout from "./Layout.vue";

type ParsedStatus = "ok" | "unstable" | "error" | "unknown";

defineProps<{
  pageStatusLabel: string;
  services: { domain: string; label: string | null; days: ParsedStatus[] }[];
}>();
</script>

<template>
  <Layout>
    <Head title="Status" />
    <p class="page-status">{{ pageStatusLabel }}</p>

    <div class="services">
      <div v-for="service in services" :key="service.domain" class="service">
        <p class="name">{{ service.label ?? service.domain }}</p>
        <p class="domain">{{ service.domain }}</p>
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
  font-size: 20px;
  font-weight: 600;
  margin: 8px 0 24px;
}

.services {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.service .name {
  font-weight: 700;
  font-size: 18px;
  margin: 0;
}

.service .domain {
  color: var(--muted);
  font-size: 13px;
  margin: 0 0 8px;
}

.history {
  display: grid;
  grid-template-columns: repeat(90, minmax(3px, 1fr));
  gap: 2px;
}

.history .day {
  height: 28px;
  border-radius: 2px;
  background: var(--border);
}

.history .day.ok {
  background: #22c55e;
}

.history .day.unstable {
  background: #eab308;
}

.history .day.error {
  background: #ef4444;
}

.empty {
  text-align: center;
  color: var(--muted);
}
</style>
