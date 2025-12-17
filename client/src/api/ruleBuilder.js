import api from './index'

export async function sendMessage(libraryId, message, conversationId = null) {
  return api.post('/api/rule-builder/message', {
    libraryId,
    message,
    conversationId,
  })
}

export async function generateRule(libraryId, conversationId) {
  return api.post('/api/rule-builder/generate', {
    libraryId,
    conversationId,
  })
}

export async function saveRule(libraryId, rule) {
  return api.post(`/api/libraries/${libraryId}/rules`, rule)
}
