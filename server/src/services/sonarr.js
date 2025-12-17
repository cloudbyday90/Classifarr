const axios = require('axios');

class SonarrService {
  async testConnection(url, apiKey) {
    try {
      const response = await axios.get(`${url}/api/v3/system/status`, {
        headers: {
          'X-Api-Key': apiKey,
        },
        timeout: 5000,
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getRootFolders(url, apiKey) {
    try {
      const response = await axios.get(`${url}/api/v3/rootfolder`, {
        headers: {
          'X-Api-Key': apiKey,
        },
      });
      return response.data.map(rf => ({
        id: rf.id,
        path: rf.path,
        freeSpace: rf.freeSpace,
        totalSpace: rf.totalSpace
      }));
    } catch (error) {
      throw new Error(`Failed to fetch root folders: ${error.message}`);
    }
  }

  async getQualityProfiles(url, apiKey) {
    try {
      const response = await axios.get(`${url}/api/v3/qualityprofile`, {
        headers: {
          'X-Api-Key': apiKey,
        },
      });
      return response.data.map(qp => ({
        id: qp.id,
        name: qp.name,
        upgradeAllowed: qp.upgradeAllowed
      }));
    } catch (error) {
      throw new Error(`Failed to fetch quality profiles: ${error.message}`);
    }
  }

  async getTags(url, apiKey) {
    try {
      const response = await axios.get(`${url}/api/v3/tag`, {
        headers: {
          'X-Api-Key': apiKey,
        },
      });
      return response.data.map(tag => ({
        id: tag.id,
        label: tag.label
      }));
    } catch (error) {
      throw new Error(`Failed to fetch tags: ${error.message}`);
    }
  }

  getSeriesTypeOptions() {
    return [
      { value: 'standard', label: 'Standard', description: 'Episodes with S##E## numbering (most shows)' },
      { value: 'anime', label: 'Anime', description: 'Absolute episode numbering (anime shows)' },
      { value: 'daily', label: 'Daily', description: 'Date-based episodes (talk shows, news, etc.)' }
    ];
  }

  getSeasonMonitoringOptions() {
    return [
      { value: 'all', label: 'All Seasons', description: 'Monitor all seasons' },
      { value: 'future', label: 'Future Seasons', description: 'Only monitor future seasons' },
      { value: 'missing', label: 'Missing Episodes', description: 'Monitor missing episodes in all seasons' },
      { value: 'existing', label: 'Existing Episodes', description: 'Monitor only existing episodes' },
      { value: 'recent', label: 'Recent Episodes', description: 'Monitor recent episodes only' },
      { value: 'pilot', label: 'Pilot Only', description: 'Only monitor the pilot episode' },
      { value: 'firstSeason', label: 'First Season', description: 'Only monitor the first season' },
      { value: 'lastSeason', label: 'Last Season', description: 'Only monitor the last season' },
      { value: 'none', label: 'None', description: 'Don\'t monitor any episodes' }
    ];
  }

  async addSeries(url, apiKey, seriesData) {
    try {
      const response = await axios.post(`${url}/api/v3/series`, seriesData, {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to add series to Sonarr: ${error.message}`);
    }
  }

  async searchSeries(url, apiKey, tvdbId) {
    try {
      const response = await axios.get(`${url}/api/v3/series/lookup`, {
        headers: {
          'X-Api-Key': apiKey,
        },
        params: {
          term: `tvdb:${tvdbId}`,
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to search series: ${error.message}`);
    }
  }
}

module.exports = new SonarrService();
