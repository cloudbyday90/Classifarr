<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2024-2026 Classifarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <section
    class="rounded-lg border border-amber-700/70 bg-amber-950/30 p-4 text-amber-100"
    aria-labelledby="policy-native-recovery-title"
  >
    <p class="text-xs font-semibold uppercase tracking-wide text-amber-200">
      Existing policy
    </p>
    <h2
      id="policy-native-recovery-title"
      class="mt-1 text-lg font-semibold"
    >
      Native policy recovery in progress
    </h2>
    <p class="mt-2 text-sm text-amber-50">
      Classifarr found an incomplete or conflicting native policy record. This policy remains read-only while server-owned reconciliation protects its stored behavior.
    </p>
    <p
      class="mt-3 rounded border border-amber-700/70 bg-background/50 px-3 py-2 text-sm"
      role="status"
      aria-atomic="true"
    >
      Compatibility editing and native setup are unavailable until the server confirms one valid native policy intent.
    </p>
  </section>
</template>

<script setup>
defineOptions({
  name: 'PolicyNativePolicyRecoveryNotice',
})
</script>
