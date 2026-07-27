<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    class="rounded-lg border border-blue-800/70 bg-blue-950/30 p-4 text-blue-100"
    aria-labelledby="policy-native-authority-status-title"
  >
    <p
      class="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      This policy uses server-reported native destination intent.
    </p>
    <h4
      id="policy-native-authority-status-title"
      class="font-semibold"
    >
      Native destination intent
    </h4>
    <p class="mt-1 text-sm text-blue-50">
      This policy uses its stored native intent. The workflow above shows its current readiness; compatibility presets and thresholds are not available for native policies.
    </p>
  </section>
</template>

<script setup>
defineOptions({
  name: 'PolicyNativeAuthorityStatus',
})
</script>
