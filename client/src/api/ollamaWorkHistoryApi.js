/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getDataRequest } from './core'

export function getOllamaWorkHistory(params = {}, signal) {
  return getDataRequest('/settings/ollama/gateway-history', { params, signal })
}

export default { getOllamaWorkHistory }
