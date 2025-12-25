<template>
  <div v-if="visible && status && status.status === 'incomplete'" class="setup-banner">
    <div class="banner-content">
      <div class="banner-icon">
        <svg xmlns="http://www.w3.org/2000/svg" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div class="banner-text">
        <h3>Re-Classification Setup Incomplete</h3>
        <p>To enable media re-classification and learned corrections:</p>
        <ul>
          <li v-for="issue in status.issues" :key="issue.type">
            {{ issue.message }} → <span class="action">{{ issue.action }}</span>
          </li>
        </ul>
      </div>
      <div class="banner-actions">
        <router-link to="/settings" class="btn btn-primary">Configure Now</router-link>
        <button @click="dismiss" class="btn btn-secondary">Remind Me Later</button>
        <a href="https://github.com/cloudbyday90/Classifarr/wiki/Re-Classification-Setup" 
           target="_blank" 
           class="btn btn-ghost">Documentation</a>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import api from '@/api';

export default {
  name: 'SetupBanner',
  setup() {
    const status = ref(null);
    const visible = ref(true);
    const dismissed = ref(false);

    const fetchStatus = async () => {
      try {
        const response = await api.get('/settings/setup-status');
        status.value = response.data;
        
        // Check if user dismissed banner this session
        const sessionDismissed = sessionStorage.getItem('setupBannerDismissed');
        if (sessionDismissed === 'true') {
          visible.value = false;
        }
      } catch (error) {
        console.error('Failed to fetch setup status:', error);
      }
    };

    const dismiss = () => {
      visible.value = false;
      sessionStorage.setItem('setupBannerDismissed', 'true');
    };

    onMounted(fetchStatus);

    return {
      status,
      visible,
      dismissed,
      dismiss
    };
  }
};
</script>

<style scoped>
.setup-banner {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.1) 100%);
  border: 1px solid rgba(245, 158, 11, 0.4);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.banner-content {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}

.banner-icon {
  flex-shrink: 0;
}

.banner-icon .icon {
  width: 32px;
  height: 32px;
  color: #f59e0b;
}

.banner-text {
  flex: 1;
  min-width: 300px;
}

.banner-text h3 {
  margin: 0 0 0.5rem;
  color: #fbbf24;
  font-size: 1.1rem;
  font-weight: 600;
}

.banner-text p {
  margin: 0 0 0.5rem;
  color: #d1d5db;
  font-size: 0.9rem;
}

.banner-text ul {
  margin: 0;
  padding-left: 1.25rem;
  color: #9ca3af;
  font-size: 0.85rem;
}

.banner-text li {
  margin-bottom: 0.25rem;
}

.banner-text .action {
  color: #60a5fa;
}

.banner-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: #f59e0b;
  color: #1f2937;
}

.btn-primary:hover {
  background: #d97706;
}

.btn-secondary {
  background: rgba(156, 163, 175, 0.2);
  color: #9ca3af;
}

.btn-secondary:hover {
  background: rgba(156, 163, 175, 0.3);
}

.btn-ghost {
  background: transparent;
  color: #60a5fa;
}

.btn-ghost:hover {
  text-decoration: underline;
}
</style>
