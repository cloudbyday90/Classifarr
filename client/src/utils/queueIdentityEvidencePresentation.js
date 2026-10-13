/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { queueMetadataCheckMessage } from './queueMetadataCheckPresentation'

const messages = Object.freeze({
  candidate_for_review: 'Saved external IDs agree with another TMDb record. This is a candidate for review, not an approved replacement.',
  external_ids_missing: 'This request has no saved IMDb or supported TVDB ID to check. Open a GitHub issue with the task reference; a similar title is not enough to replace it.',
  source_unavailable: 'The linked request is no longer available. Open a GitHub issue with the task reference before attempting an identity repair.',
  source_conflict: 'The task and its linked request disagree about the original identity. Open a GitHub issue with the task reference.',
  invalid_external_id: 'A saved external ID is invalid. Open a GitHub issue with the task reference; no replacement was selected.',
  conflicting_external_ids: 'The saved external IDs disagree. Open a GitHub issue with the task reference; no replacement was selected.',
  external_id_not_found: 'TMDb has no matching movie or series for a saved external ID. No replacement was selected.',
  original_id_only: 'External-ID lookup still points to the missing original record. No replacement was selected; check again later.',
  reverse_id_conflict: 'The candidate’s external IDs do not confirm every saved ID. Open a GitHub issue with the task reference.',
  ambiguous_external_id: 'TMDb returned more than one match. Open a GitHub issue with the task reference; no replacement was selected.',
})

export function queueIdentityEvidenceMessage(evidence) {
  if (evidence?.reason === 'provider_unavailable') {
    if (evidence.observation?.category === 'not_found') return 'A record needed for the external-ID check is unavailable. No replacement was selected; check again later.'
    if (evidence.observation?.category === 'invalid_response') return 'TMDb returned candidate details that could not be verified. Open a GitHub issue with the task reference and check details.'
    return `The external-ID check could not finish. ${queueMetadataCheckMessage(evidence.observation?.category)}`
  }
  return Object.hasOwn(messages, evidence?.reason) ? messages[evidence.reason]
    : 'The external-ID evidence could not be verified. Open a GitHub issue with the task reference and check details.'
}

export function queueIdentityEvidenceSources(sources) {
  return [...new Set(Array.isArray(sources) ? sources : [])]
    .filter(source => source === 'imdb_id' || source === 'tvdb_id')
    .map(source => source === 'imdb_id' ? 'IMDb' : 'TVDB').join(', ')
}
