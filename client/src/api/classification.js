import api from './index'

export async function getHistory(filters = {}) {
  return api.get('/api/classifications/history', { params: filters })
}

export async function getStats() {
  return api.get('/api/classifications/stats')
}

export async function getClassification(id) {
  return api.get(`/api/classifications/${id}`)
}

export async function correctClassification(id, corrections) {
  return api.post(`/api/classifications/${id}/correct`, corrections)
}

export async function exportHistory(filters = {}) {
  return api.get('/api/classifications/export', { 
    params: filters,
    responseType: 'blob'
  })
}
