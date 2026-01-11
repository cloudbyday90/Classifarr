<!--
  Classifarr - AI-powered media classification for the *arr ecosystem
  Copyright (C) 2026 cloudbyday90
  
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-4">
      <Button @click="$router.back()" variant="secondary">← Back</Button>
      <h1 class="text-2xl font-bold">Rule Builder</h1>
    </div>

    <!-- Deprecation Notice -->
    <div class="deprecation-notice">
      <div class="icon">⚠️</div>
      <div class="content">
        <h3>Legacy Rule System - Deprecated</h3>
        <p>
          Custom rules are being replaced by the more powerful <strong>Policy Engine</strong> system.
          This Rule Builder will be removed in <strong>v0.39.0</strong>.
        </p>
        <p class="migration-cta">
          <router-link to="/migration" class="btn-migrate">
            🔄 Use Migration Wizard to convert existing rules
          </router-link>
          <span class="separator">or</span>
          <router-link to="/policies" class="btn-policies">
            ✨ Create new Policies instead
          </router-link>
        </p>
      </div>
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

<style scoped>
.deprecation-notice {
  display: flex;
  gap: 1.5rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, #fff3cd 0%, #ffe6a3 100%);
  border-left: 6px solid #ff9800;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(255, 152, 0, 0.15);
}

.deprecation-notice .icon {
  font-size: 2.5rem;
  flex-shrink: 0;
}

.deprecation-notice .content {
  flex: 1;
}

.deprecation-notice h3 {
  margin: 0 0 0.5rem 0;
  color: #856404;
  font-size: 1.25rem;
  font-weight: 700;
}

.deprecation-notice p {
  margin: 0.5rem 0;
  color: #856404;
  line-height: 1.6;
}

.migration-cta {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}

.btn-migrate,
.btn-policies {
  padding: 0.75rem 1.25rem;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.95rem;
  transition: all 0.2s ease;
  display: inline-block;
}

.btn-migrate {
  background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
  color: white;
}

.btn-migrate:hover {
  background: linear-gradient(135deg, #f57c00 0%, #ef6c00 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(255, 152, 0, 0.4);
}

.btn-policies {
  background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%);
  color: white;
}

.btn-policies:hover {
  background: linear-gradient(135deg, #388e3c 0%, #2e7d32 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(76, 175, 80, 0.4);
}

.separator {
  color: #856404;
  font-weight: 500;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .deprecation-notice {
    background: linear-gradient(135deg, #4a3800 0%, #5a4200 100%);
    border-left-color: #ff9800;
  }

  .deprecation-notice h3,
  .deprecation-notice p,
  .separator {
    color: #ffd54f;
  }
}
</style>
