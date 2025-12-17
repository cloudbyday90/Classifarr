<template>
  <div id="app">
    <header class="header">
      <div class="container">
        <h1>🎬 Classifarr</h1>
        <p>AI-Powered Media Classification</p>
      </div>
    </header>

    <main class="container">
      <div class="card">
        <h2>Welcome to Classifarr</h2>
        <p>Intelligent media classification for Plex, Emby, and Jellyfin.</p>
        
        <div v-if="health" class="status">
          <p class="success">✓ Server Status: {{ health.status }}</p>
          <p>Uptime: {{ formatUptime(health.uptime) }}</p>
        </div>
        <div v-else class="status">
          <p class="warning">⚠ Connecting to server...</p>
        </div>
      </div>

      <div class="card" v-if="stats">
        <h2>Classification Statistics</h2>
        <ul>
          <li>Total Classifications: {{ stats.total }}</li>
          <li>Average Confidence: {{ stats.averageConfidence }}%</li>
          <li>Total Corrections: {{ stats.totalCorrections }}</li>
          <li>Correction Rate: {{ stats.correctionRate }}</li>
        </ul>
      </div>

      <div class="card">
        <h2>Quick Start</h2>
        <ol>
          <li>Configure your media server (Plex, Emby, or Jellyfin)</li>
          <li>Sync your libraries</li>
          <li>Assign labels to each library</li>
          <li>Configure Radarr/Sonarr for automatic routing</li>
          <li>Set up Discord notifications</li>
          <li>Connect Overseerr webhook to start classifying!</li>
        </ol>
      </div>

      <div class="card">
        <h2>API Endpoints</h2>
        <ul>
          <li><a href="/api/health" target="_blank">Health Check</a></li>
          <li><a href="/api/libraries" target="_blank">Libraries</a></li>
          <li><a href="/api/classification/stats" target="_blank">Classification Stats</a></li>
          <li><a href="/api/classification/history" target="_blank">Classification History</a></li>
        </ul>
      </div>
    </main>

    <footer class="footer">
      <div class="container">
        <p>&copy; 2024 Classifarr - Licensed under GPL-3.0</p>
      </div>
    </footer>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'App',
  data() {
    return {
      health: null,
      stats: null
    }
  },
  mounted() {
    this.fetchHealth();
    this.fetchStats();
  },
  methods: {
    async fetchHealth() {
      try {
        const response = await axios.get('/api/health');
        this.health = response.data;
      } catch (err) {
        console.error('Failed to fetch health:', err);
      }
    },
    async fetchStats() {
      try {
        const response = await axios.get('/api/classification/stats');
        this.stats = response.data;
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    },
    formatUptime(seconds) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }
}
</script>

<style scoped>
.header {
  background: #2d2d2d;
  padding: 20px 0;
  margin-bottom: 30px;
}

.header h1 {
  margin: 0;
  font-size: 2.5rem;
}

.header p {
  color: #888;
  margin: 5px 0 0 0;
}

.status {
  background: #1a1a1a;
  padding: 15px;
  border-radius: 4px;
  margin-top: 15px;
}

.footer {
  background: #2d2d2d;
  padding: 20px 0;
  margin-top: 50px;
  text-align: center;
  color: #888;
}

ul, ol {
  margin-left: 20px;
}

li {
  margin: 8px 0;
}
</style>
