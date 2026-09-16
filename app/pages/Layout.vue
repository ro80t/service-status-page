<script setup lang="ts">
import { Link } from "@inertiajs/vue3";
</script>

<template>
  <div class="app">
    <header>
      <nav>
        <Link href="/">Home</Link>
      </nav>
    </header>
    <main>
      <slot />
    </main>
  </div>
</template>
