<template>
  <div class="settings">
    <h1>Settings</h1>
    
    <div class="settings-container">
      <aside class="settings-sidebar">
        <nav class="settings-nav">
          <router-link to="/settings/general" class="settings-nav-item">
            General
          </router-link>
          <router-link to="/settings/tmdb" class="settings-nav-item">
            TMDB
          </router-link>
          <router-link to="/settings/ollama" class="settings-nav-item">
            AI / Ollama
          </router-link>
          <router-link to="/settings/discord" class="settings-nav-item">
            Discord
          </router-link>
          <router-link to="/settings/webhooks" class="settings-nav-item">
            Webhooks
          </router-link>
        </nav>
      </aside>
      
      <div class="settings-content">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Settings'
}
</script>

<style scoped>
.settings {
  width: 100%;
}

h1 {
  margin-bottom: 2rem;
}

.settings-container {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 2rem;
}

.settings-sidebar {
  background: #1e293b;
  border-radius: 0.5rem;
  padding: 1rem;
  height: fit-content;
  border: 1px solid #334155;
}

.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.settings-nav-item {
  padding: 0.75rem 1rem;
  color: #cbd5e1;
  text-decoration: none;
  border-radius: 0.375rem;
  transition: all 0.2s;
}

.settings-nav-item:hover {
  background: #334155;
  color: #f1f5f9;
}

.settings-nav-item.router-link-active {
  background: #3b82f6;
  color: white;
}

.settings-content {
  flex: 1;
}
</style>
