import api from './index'

export async function getLibraries() {
  return api.get('/api/libraries')
}

export async function getLibrary(id) {
  return api.get(`/api/libraries/${id}`)
}

export async function updateLibrary(id, data) {
  return api.put(`/api/libraries/${id}`, data)
}

export async function syncLibraries() {
  return api.post('/api/libraries/sync')
}
