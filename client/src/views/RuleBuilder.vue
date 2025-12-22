<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2025 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-4">
      <Button @click="$router.back()" variant="secondary">← Back</Button>
      <h1 class="text-2xl font-bold">Rule Builder</h1>
    </div>

    <!-- Smart Rule Form -->
    <SmartRuleForm 
      :libraryId="route.params.libraryId" 
      @cancel="$router.back()"
      @save="onSave"
    />
  </div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import SmartRuleForm from '@/components/SmartRuleForm.vue'
import Button from '@/components/common/Button.vue'

const route = useRoute()
const router = useRouter()

const onSave = () => {
  router.back()
}
</script>
