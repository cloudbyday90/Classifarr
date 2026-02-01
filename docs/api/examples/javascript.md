# JavaScript/Node.js Examples

Complete JavaScript/Node.js examples for all major Classifarr API operations using async/await.

---

## Table of Contents

1. [Setup](#setup)
2. [Authentication](#authentication)
3. [System Health](#system-health)
4. [Libraries](#libraries)
5. [Media Sync](#media-sync)
6. [Classification](#classification)
7. [Policies](#policies)
8. [Error Handling](#error-handling)
9. [Complete Examples](#complete-examples)

---

## Setup

### Install Dependencies

```bash
npm install node-fetch
```

### Basic Configuration

```javascript
// config.js
const config = {
  baseUrl: process.env.CLASSIFARR_URL || 'http://localhost:21324',
  apiKey: process.env.CLASSIFARR_API_KEY || 'clf_your_api_key_here'
};

module.exports = config;
```

### API Client Class

```javascript
// classifarr-client.js
const fetch = require('node-fetch');

class ClassifarrClient {
  constructor(baseUrl, apiKey = null, jwtToken = null) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.jwtToken = jwtToken;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Add authentication
    if (this.jwtToken) {
      headers['Authorization'] = `Bearer ${this.jwtToken}`;
    } else if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url, { method: 'GET' });
  }

  async post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

module.exports = ClassifarrClient;
```

---

## Authentication

### Login (Get JWT Token)

```javascript
const ClassifarrClient = require('./classifarr-client');
const config = require('./config');

async function login(username, password) {
  const client = new ClassifarrClient(config.baseUrl);
  
  const response = await client.post('/api/auth/login', {
    username,
    password
  });
  
  console.log('Login successful');
  console.log('Token:', response.token);
  
  // Create new client with JWT token
  return new ClassifarrClient(config.baseUrl, null, response.token);
}

// Usage
(async () => {
  const client = await login('admin', 'your-password');
})();
```

### Create API Key (Requires JWT)

```javascript
async function createApiKey(client, name, permissions = 'read_write', expiresAt = null) {
  const keyData = {
    name,
    permissions
  };
  
  if (expiresAt) {
    keyData.expires_at = expiresAt;
  }
  
  const response = await client.post('/api/keys', keyData);
  
  console.log('API Key created:', response);
  return response;
}

// Usage
(async () => {
  const client = await login('admin', 'your-password');
  
  const apiKey = await createApiKey(
    client,
    'Automation Script',
    'read_write',
    '2026-12-31T23:59:59Z'
  );
  
  console.log('API Key ID:', apiKey.id);
})();
```

### List API Keys

```javascript
async function listApiKeys(client) {
  const keys = await client.get('/api/keys');
  
  console.log('API Keys:');
  keys.forEach(key => {
    console.log(`- ${key.name} (${key.permissions})`);
    console.log(`  Created: ${key.created_at}`);
    console.log(`  Expires: ${key.expires_at || 'Never'}`);
  });
  
  return keys;
}
```

### Reveal API Key

```javascript
async function revealApiKey(client, keyId) {
  const response = await client.get(`/api/keys/${keyId}/reveal`);
  
  console.log('API Key:', response.key);
  return response.key;
}
```

---

## System Health

### Get Overall Health

```javascript
const ClassifarrClient = require('./classifarr-client');
const config = require('./config');

const client = new ClassifarrClient(config.baseUrl, config.apiKey);

async function getHealth() {
  const health = await client.get('/api/system/health');
  
  console.log('Status:', health.status);
  console.log('Database:', health.database ? '✓' : '✗');
  console.log('Plex:', health.plex ? '✓' : '✗');
  
  return health;
}
```

### Get Detailed Service Health

```javascript
async function getServiceHealth() {
  const health = await client.get('/api/system/health/services');
  
  console.log('Overall:', health.overall);
  console.log('Services:');
  
  health.services.forEach(service => {
    const icon = service.status === 'healthy' ? '✓' : 
                 service.status === 'degraded' ? '⚠' : '✗';
    
    console.log(`  ${icon} ${service.name}: ${service.status}`);
    console.log(`    Success rate: ${service.successRate.toFixed(1)}%`);
    console.log(`    Avg response: ${service.averageResponseTime.toFixed(0)}ms`);
    
    if (service.trend !== 'stable') {
      console.log(`    Trend: ${service.trend}`);
    }
  });
  
  return health;
}
```

### Force Refresh Health Checks

```javascript
async function refreshHealthChecks() {
  const result = await client.post('/api/system/health/refresh');
  
  console.log('Health checks refreshed');
  console.log('Status:', result.status);
  
  return result;
}
```

### Liveness and Readiness Probes

```javascript
async function checkLiveness() {
  try {
    await client.get('/api/system/health/live');
    console.log('Liveness: OK');
    return true;
  } catch (error) {
    console.error('Liveness: Failed');
    return false;
  }
}

async function checkReadiness() {
  try {
    await client.get('/api/system/health/ready');
    console.log('Readiness: OK');
    return true;
  } catch (error) {
    console.error('Readiness: Failed');
    return false;
  }
}
```

### Get System Status

```javascript
async function getSystemStatus() {
  const status = await client.get('/api/system/status');
  
  console.log('Version:', status.version);
  console.log('Uptime:', Math.floor(status.uptime / 3600), 'hours');
  console.log('Environment:', status.environment);
  
  return status;
}
```

---

## Libraries

### List All Libraries

```javascript
async function listLibraries() {
  const libraries = await client.get('/api/libraries');
  
  console.log(`Found ${libraries.length} libraries:`);
  libraries.forEach(lib => {
    console.log(`- [${lib.id}] ${lib.name}`);
    console.log(`  Priority: ${lib.priority}`);
    console.log(`  Active: ${lib.is_active ? 'Yes' : 'No'}`);
    console.log(`  Items: ${lib.item_count || 0}`);
  });
  
  return libraries;
}
```

### Get Library Details

```javascript
async function getLibrary(libraryId) {
  const library = await client.get(`/api/libraries/${libraryId}`);
  
  console.log('Library:', library.name);
  console.log('Type:', library.type);
  console.log('Plex Key:', library.plex_library_key);
  console.log('Items:', library.item_count);
  
  return library;
}
```

### Update Library

```javascript
async function updateLibrary(libraryId, updates) {
  const library = await client.put(`/api/libraries/${libraryId}`, updates);
  
  console.log('Library updated:', library.name);
  return library;
}

// Usage
(async () => {
  await updateLibrary(1, {
    name: 'Kids & Family Movies',
    priority: 95,
    is_active: true
  });
})();
```

### Delete Library

```javascript
async function deleteLibrary(libraryId) {
  await client.delete(`/api/libraries/${libraryId}`);
  console.log(`Library ${libraryId} deleted`);
}
```

### Get Libraries with Pending Suggestions

```javascript
async function getPendingSuggestions() {
  const libraries = await client.get('/api/libraries/pending-suggestions');
  
  console.log('Libraries with pending suggestions:');
  libraries.forEach(lib => {
    console.log(`- ${lib.name}: ${lib.pending_count} pending`);
  });
  
  return libraries;
}
```

---

## Media Sync

### Trigger Library Sync

```javascript
async function syncLibrary(libraryId, options = {}) {
  const {
    incremental = false,
    batchSize = 100
  } = options;
  
  console.log(`Starting ${incremental ? 'incremental' : 'full'} sync...`);
  
  const result = await client.post(`/api/media-sync/sync/${libraryId}`, {
    incremental,
    batchSize
  });
  
  console.log('Sync completed:');
  console.log(`- Added: ${result.stats.added}`);
  console.log(`- Updated: ${result.stats.updated}`);
  console.log(`- Removed: ${result.stats.removed}`);
  console.log(`- Duration: ${result.stats.duration}ms`);
  
  return result;
}

// Full sync
(async () => {
  await syncLibrary(1, { incremental: false, batchSize: 100 });
})();

// Incremental sync
(async () => {
  await syncLibrary(1, { incremental: true });
})();
```

### Get Library Items

```javascript
async function getLibraryItems(libraryId, options = {}) {
  const {
    limit = 50,
    offset = 0
  } = options;
  
  const result = await client.get(`/api/media-sync/items/${libraryId}`, {
    limit,
    offset
  });
  
  console.log(`Items ${offset + 1}-${offset + result.items.length} of ${result.total}`);
  
  result.items.forEach(item => {
    console.log(`- ${item.title} (${item.year || 'N/A'})`);
    console.log(`  TMDB: ${item.tmdb_id}, Type: ${item.media_type}`);
  });
  
  return result;
}

// Paginated fetching
async function getAllLibraryItems(libraryId) {
  const allItems = [];
  const limit = 100;
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    const result = await getLibraryItems(libraryId, { limit, offset });
    allItems.push(...result.items);
    
    offset += limit;
    hasMore = offset < result.total;
  }
  
  console.log(`Fetched ${allItems.length} total items`);
  return allItems;
}
```

### Lookup Media by TMDB ID

```javascript
async function lookupMedia(tmdbId, mediaType) {
  const result = await client.get(`/api/media-sync/lookup/${tmdbId}`, {
    mediaType
  });
  
  if (result.exists) {
    console.log(`Found in library: ${result.library.name}`);
    console.log(`Title: ${result.item.title}`);
  } else {
    console.log('Not found in any library');
  }
  
  return result;
}

// Check if movie exists
(async () => {
  await lookupMedia(862, 'movie'); // Toy Story
})();

// Check if TV show exists
(async () => {
  await lookupMedia(1399, 'tv'); // Game of Thrones
})();
```

### Get Sync Status

```javascript
async function getSyncStatus(libraryId = null) {
  const params = libraryId ? { libraryId } : {};
  const status = await client.get('/api/media-sync/sync/status', params);
  
  if (Array.isArray(status)) {
    // Multiple libraries
    status.forEach(lib => {
      console.log(`Library ${lib.library_id}:`);
      console.log(`  Status: ${lib.status}`);
      if (lib.progress) {
        console.log(`  Progress: ${lib.progress.current}/${lib.progress.total}`);
      }
    });
  } else {
    // Single library
    console.log(`Status: ${status.status}`);
    if (status.progress) {
      console.log(`Progress: ${status.progress.current}/${status.progress.total}`);
      console.log(`Percentage: ${status.progress.percentage}%`);
    }
  }
  
  return status;
}
```

---

## Classification

### Classify Media

```javascript
async function classifyMedia(tmdbId, mediaType, title) {
  const result = await client.post('/api/classification/classify', {
    tmdb_id: tmdbId,
    media_type: mediaType,
    title
  });
  
  console.log('Classification Result:');
  console.log(`- Library: ${result.library.name}`);
  console.log(`- Confidence: ${result.confidence}%`);
  console.log(`- Method: ${result.method}`);
  
  if (result.reasoning) {
    console.log(`- Reasoning: ${result.reasoning}`);
  }
  
  return result;
}

// Usage
(async () => {
  await classifyMedia(862, 'movie', 'Toy Story');
})();
```

### Get Classification History

```javascript
async function getClassificationHistory(options = {}) {
  const {
    limit = 20,
    offset = 0,
    excludeMethod = null,
    libraryId = null,
    mediaType = null
  } = options;
  
  const params = { limit, offset };
  if (excludeMethod) params.excludeMethod = excludeMethod;
  if (libraryId) params.library_id = libraryId;
  if (mediaType) params.media_type = mediaType;
  
  const result = await client.get('/api/classification/history', params);
  
  console.log(`Classifications ${offset + 1}-${offset + result.items.length} of ${result.total}`);
  
  result.items.forEach(item => {
    console.log(`- ${item.title} → ${item.library_name}`);
    console.log(`  Confidence: ${item.confidence}%, Method: ${item.method}`);
    console.log(`  Date: ${new Date(item.created_at).toLocaleString()}`);
  });
  
  return result;
}

// Recent classifications (exclude source_library)
(async () => {
  await getClassificationHistory({
    limit: 20,
    excludeMethod: 'source_library'
  });
})();

// Filter by library
(async () => {
  await getClassificationHistory({ libraryId: 1 });
})();

// Filter by media type
(async () => {
  await getClassificationHistory({ mediaType: 'movie' });
})();
```

### Get Classification Details

```javascript
async function getClassificationDetails(classificationId) {
  const classification = await client.get(`/api/classification/history/${classificationId}`);
  
  console.log('Classification Details:');
  console.log(`Title: ${classification.title}`);
  console.log(`Library: ${classification.library_name}`);
  console.log(`Confidence: ${classification.confidence}%`);
  console.log(`Method: ${classification.method}`);
  
  if (classification.scores) {
    console.log('Scores:');
    Object.entries(classification.scores).forEach(([lib, score]) => {
      console.log(`  ${lib}: ${score}`);
    });
  }
  
  return classification;
}
```

### Submit Correction

```javascript
async function submitCorrection(classificationId, correctLibraryId, reason) {
  const correction = await client.post('/api/classification/corrections', {
    classification_id: classificationId,
    correct_library_id: correctLibraryId,
    reason
  });
  
  console.log('Correction submitted:', correction.id);
  return correction;
}

// Usage
(async () => {
  await submitCorrection(1, 2, 'Should be in 4K library');
})();
```

---

## Policies

### List All Policies

```javascript
async function listPolicies() {
  const policies = await client.get('/api/policies');
  
  console.log(`Found ${policies.length} policies:`);
  policies.forEach(policy => {
    console.log(`- [${policy.id}] ${policy.name}`);
    console.log(`  Library: ${policy.library_name}`);
    console.log(`  Auto-classify threshold: ${policy.auto_classify_threshold}%`);
    console.log(`  Prompt threshold: ${policy.prompt_threshold}%`);
  });
  
  return policies;
}
```

### Get Policy Details

```javascript
async function getPolicy(policyId) {
  const policy = await client.get(`/api/policies/${policyId}`);
  
  console.log('Policy:', policy.name);
  console.log('Weights:');
  console.log(`  Preset: ${policy.preset_weight}`);
  console.log(`  Pattern: ${policy.pattern_weight}`);
  console.log(`  RAG: ${policy.rag_weight}`);
  console.log(`  History: ${policy.history_weight}`);
  
  return policy;
}
```

### Create Policy

```javascript
async function createPolicy(libraryId, policyData) {
  const policy = await client.post('/api/policies', {
    library_id: libraryId,
    ...policyData
  });
  
  console.log('Policy created:', policy.name);
  return policy;
}

// Usage
(async () => {
  const policy = await createPolicy(1, {
    name: 'Kids Movies Policy',
    auto_classify_threshold: 85,
    prompt_threshold: 60,
    preset_weight: 0.40,
    pattern_weight: 0.25,
    rag_weight: 0.20,
    history_weight: 0.15,
    preset_ids: [1, 2, 3],
    preset_weights: {
      '1': 1.0,
      '2': 1.0,
      '3': 0.8
    }
  });
})();
```

### Update Policy

```javascript
async function updatePolicy(policyId, updates) {
  const policy = await client.put(`/api/policies/${policyId}`, updates);
  
  console.log('Policy updated:', policy.name);
  return policy;
}

// Usage
(async () => {
  await updatePolicy(1, {
    auto_classify_threshold: 90,
    prompt_threshold: 70
  });
})();
```

### Delete Policy

```javascript
async function deletePolicy(policyId) {
  await client.delete(`/api/policies/${policyId}`);
  console.log(`Policy ${policyId} deleted`);
}
```

### List Presets

```javascript
async function listPresets(options = {}) {
  const { category = null, search = null } = options;
  
  const params = {};
  if (category) params.category = category;
  if (search) params.search = search;
  
  const presets = await client.get('/api/presets', params);
  
  console.log(`Found ${presets.length} presets:`);
  presets.forEach(preset => {
    console.log(`- [${preset.id}] ${preset.name}`);
    console.log(`  Category: ${preset.category}`);
  });
  
  return presets;
}

// All presets
(async () => {
  await listPresets();
})();

// Filter by category
(async () => {
  await listPresets({ category: 'genre' });
})();

// Search presets
(async () => {
  await listPresets({ search: 'action' });
})();
```

---

## Error Handling

### Handle Specific Error Codes

```javascript
async function handleLibraryNotFound(libraryId) {
  try {
    const library = await client.get(`/api/libraries/${libraryId}`);
    console.log('Library found:', library.name);
    return library;
  } catch (error) {
    if (error.status === 404) {
      console.error('Error: Library not found');
      return null;
    }
    throw error;
  }
}
```

### Handle Sync Already in Progress

```javascript
async function handleSyncConflict(libraryId) {
  try {
    const result = await client.post(`/api/media-sync/sync/${libraryId}`, {
      incremental: false
    });
    
    console.log('Sync completed:', result.stats);
    return result;
  } catch (error) {
    if (error.status === 409) {
      console.log('Sync already in progress');
      console.log('Progress:', error.data.progress);
      
      // Wait and check status
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const status = await client.get('/api/media-sync/sync/status', {
        libraryId
      });
      
      console.log('Current status:', status);
      return status;
    }
    throw error;
  }
}
```

### Retry with Exponential Backoff

```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry 4xx errors (except 429)
      if (error.status >= 400 && error.status < 500 && error.status !== 429) {
        throw error;
      }
      
      // Retry 5xx errors and 429
      if (error.status >= 500 || error.status === 429) {
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      throw error;
    }
  }
  
  throw lastError;
}

// Usage
(async () => {
  const libraries = await retryWithBackoff(() => 
    client.get('/api/libraries')
  );
  
  console.log('Libraries:', libraries);
})();
```

### Comprehensive Error Handler

```javascript
class ClassifarrError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ClassifarrError';
    this.status = status;
    this.data = data;
  }
}

async function safeApiCall(fn, options = {}) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    onError = null
  } = options;
  
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      const shouldRetry = 
        error.status >= 500 || 
        error.status === 429 ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT';
      
      if (shouldRetry && attempt < maxRetries - 1) {
        const delay = retryDelay * Math.pow(2, attempt);
        console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      if (onError) {
        onError(error);
      }
      
      throw new ClassifarrError(
        error.message,
        error.status,
        error.data
      );
    }
  }
  
  throw lastError;
}

// Usage
(async () => {
  try {
    const result = await safeApiCall(
      () => client.get('/api/libraries'),
      {
        maxRetries: 3,
        onError: (error) => {
          console.error('API call failed:', error.message);
        }
      }
    );
    
    console.log('Success:', result);
  } catch (error) {
    if (error instanceof ClassifarrError) {
      console.error(`API Error ${error.status}:`, error.message);
      console.error('Details:', error.data);
    } else {
      console.error('Unexpected error:', error);
    }
  }
})();
```

---

## Complete Examples

### Health Monitoring Service

```javascript
const ClassifarrClient = require('./classifarr-client');
const config = require('./config');

class HealthMonitor {
  constructor(client, interval = 30000) {
    this.client = client;
    this.interval = interval;
    this.running = false;
  }
  
  async checkHealth() {
    const health = await this.client.get('/api/system/health/services');
    
    console.log(`=== Health Check at ${new Date().toISOString()} ===`);
    console.log(`Overall Status: ${health.overall}`);
    
    // Check for degrading services
    const degrading = health.services.filter(s => s.trend === 'degrading');
    if (degrading.length > 0) {
      console.log('⚠️  Degrading services:');
      degrading.forEach(s => console.log(`  - ${s.name}`));
    }
    
    // Check for unhealthy services
    const unhealthy = health.services.filter(s => s.status === 'unhealthy');
    if (unhealthy.length > 0) {
      console.log('❌ Unhealthy services:');
      unhealthy.forEach(s => console.log(`  - ${s.name}`));
    }
    
    console.log('');
    return health;
  }
  
  start() {
    this.running = true;
    this.run();
  }
  
  stop() {
    this.running = false;
  }
  
  async run() {
    while (this.running) {
      try {
        await this.checkHealth();
      } catch (error) {
        console.error('Health check failed:', error.message);
      }
      
      await new Promise(resolve => setTimeout(resolve, this.interval));
    }
  }
}

// Usage
const client = new ClassifarrClient(config.baseUrl, config.apiKey);
const monitor = new HealthMonitor(client, 30000);
monitor.start();

// Stop after 5 minutes
setTimeout(() => monitor.stop(), 5 * 60 * 1000);
```

### Sync All Libraries

```javascript
async function syncAllLibraries(client, incremental = true) {
  const libraries = await client.get('/api/libraries');
  const activeLibraries = libraries.filter(lib => lib.is_active);
  
  console.log(`Syncing ${activeLibraries.length} active libraries...`);
  
  const results = [];
  
  for (const lib of activeLibraries) {
    console.log(`\nSyncing library: ${lib.name}`);
    
    try {
      const result = await client.post(`/api/media-sync/sync/${lib.id}`, {
        incremental
      });
      
      console.log('✓ Sync completed:');
      console.log(`  Added: ${result.stats.added}`);
      console.log(`  Updated: ${result.stats.updated}`);
      console.log(`  Removed: ${result.stats.removed}`);
      
      results.push({ library: lib.name, success: true, stats: result.stats });
    } catch (error) {
      console.error(`✗ Sync failed: ${error.message}`);
      results.push({ library: lib.name, success: false, error: error.message });
    }
    
    // Wait between syncs
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n=== Sync Summary ===');
  const successful = results.filter(r => r.success).length;
  console.log(`Successful: ${successful}/${results.length}`);
  
  return results;
}

// Usage
(async () => {
  const client = new ClassifarrClient(config.baseUrl, config.apiKey);
  await syncAllLibraries(client, true);
})();
```

### Batch Classification

```javascript
async function batchClassify(client, items, concurrency = 3) {
  const results = [];
  const queue = [...items];
  
  async function processItem() {
    while (queue.length > 0) {
      const item = queue.shift();
      
      try {
        const result = await client.post('/api/classification/classify', {
          tmdb_id: item.tmdbId,
          media_type: item.mediaType,
          title: item.title
        });
        
        console.log(`✓ ${item.title} → ${result.library.name} (${result.confidence}%)`);
        results.push({ ...item, success: true, result });
      } catch (error) {
        console.error(`✗ ${item.title}: ${error.message}`);
        results.push({ ...item, success: false, error: error.message });
      }
    }
  }
  
  // Process items with concurrency limit
  const workers = Array(concurrency).fill(null).map(() => processItem());
  await Promise.all(workers);
  
  console.log(`\nCompleted: ${results.filter(r => r.success).length}/${items.length}`);
  return results;
}

// Usage
(async () => {
  const client = new ClassifarrClient(config.baseUrl, config.apiKey);
  
  const items = [
    { tmdbId: 862, mediaType: 'movie', title: 'Toy Story' },
    { tmdbId: 863, mediaType: 'movie', title: 'Toy Story 2' },
    { tmdbId: 10193, mediaType: 'movie', title: 'Toy Story 3' }
  ];
  
  await batchClassify(client, items, 3);
})();
```

### Auto-Classification Workflow

```javascript
class AutoClassifier {
  constructor(client, libraryId) {
    this.client = client;
    this.libraryId = libraryId;
  }
  
  async sync() {
    console.log('Step 1: Syncing library...');
    const syncResult = await this.client.post(
      `/api/media-sync/sync/${this.libraryId}`,
      { incremental: true }
    );
    console.log(`✓ Synced: ${syncResult.stats.added} new items`);
    return syncResult.stats.added;
  }
  
  async getUnclassified() {
    console.log('Step 2: Finding unclassified items...');
    const items = await this.client.get(
      `/api/media-sync/items/${this.libraryId}`
    );
    
    // Filter items without classification (you'd add your logic here)
    const unclassified = items.items.filter(item => !item.classification_id);
    console.log(`✓ Found ${unclassified.length} unclassified items`);
    return unclassified;
  }
  
  async classifyAll(items) {
    console.log('Step 3: Classifying items...');
    const results = [];
    
    for (const item of items) {
      try {
        const result = await this.client.post('/api/classification/classify', {
          tmdb_id: item.tmdb_id,
          media_type: item.media_type,
          title: item.title
        });
        
        if (result.confidence >= 80) {
          console.log(`✓ ${item.title} → ${result.library.name} (${result.confidence}%)`);
          results.push({ item, result, autoClassified: true });
        } else {
          console.log(`⚠ ${item.title}: Low confidence (${result.confidence}%)`);
          results.push({ item, result, autoClassified: false });
        }
      } catch (error) {
        console.error(`✗ ${item.title}: ${error.message}`);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  }
  
  async run() {
    console.log('=== Auto-Classification Workflow ===\n');
    
    try {
      const newItems = await this.sync();
      
      if (newItems === 0) {
        console.log('No new items to classify');
        return;
      }
      
      const unclassified = await this.getUnclassified();
      const results = await this.classifyAll(unclassified);
      
      console.log('\n=== Summary ===');
      const autoClassified = results.filter(r => r.autoClassified).length;
      console.log(`Auto-classified: ${autoClassified}/${results.length}`);
      console.log(`Needs review: ${results.length - autoClassified}`);
    } catch (error) {
      console.error('Workflow failed:', error.message);
    }
  }
}

// Usage
(async () => {
  const client = new ClassifarrClient(config.baseUrl, config.apiKey);
  const classifier = new AutoClassifier(client, 1);
  await classifier.run();
})();
```

---

## Related Documentation

- [Authentication Guide](../authentication.md)
- [cURL Examples](./curl.md)
- [Python Examples](./python.md)
- [API Overview](../README.md)
