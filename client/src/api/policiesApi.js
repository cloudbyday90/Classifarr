import { apiClient, getDataRequest } from './core'

export function getPolicy(id) {
  return getDataRequest(`/policies/${id}`)
}

export function getPolicies() {
  return getDataRequest('/policies')
}

export function createPolicy(data) {
  return apiClient.post('/policies', data)
}

export function updatePolicy(id, data) {
  return apiClient.put(`/policies/${id}`, data)
}

export function deletePolicy(id) {
  return apiClient.delete(`/policies/${id}`)
}

export function getPresetSuggestions(libraryId) {
  return getDataRequest(`/policies/presets/suggest/${libraryId}`)
}

const policiesApi = {
  getPolicy,
  getPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getPresetSuggestions,
}

export default policiesApi
