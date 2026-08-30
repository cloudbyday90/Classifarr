/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';
import { ClassificationOutcomeService } from '../services/classificationOutcomeService.mjs';

const db = { query: jest.fn() };

describe('ClassificationOutcomeService', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ClassificationOutcomeService({ db, logger: { warn: jest.fn() } });
  });

  test('records outcome_link and syncs summary markers', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{
          metadata: {
            classification_details: {
              rag_loop_summary: {
                ran: true,
                adopted: true
              }
            }
          }
        }]
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await service.recordOutcome(123, {
      type: 'verified',
      source: 'discord_verification',
      actor: 'tester',
      final_library_id: 7
    });

    expect(result.updated).toBe(true);
    expect(db.query).toHaveBeenNthCalledWith(
      1,
      'SELECT metadata FROM classification_history WHERE id = $1',
      [123]
    );
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      'UPDATE classification_history SET metadata = $2::jsonb WHERE id = $1',
      [
        123,
        expect.any(String)
      ]
    );

    const updatedMetadata = JSON.parse(db.query.mock.calls[1][1][1]);
    expect(updatedMetadata.classification_details.outcome_link).toEqual(
      expect.objectContaining({
        type: 'verified',
        source: 'discord_verification',
        actor: 'tester',
        final_library_id: 7,
        recorded_at: expect.any(String),
        updated_at: expect.any(String)
      })
    );
    expect(updatedMetadata.classification_details.outcome_path).toEqual(
      expect.objectContaining({
        first_type: 'verified',
        latest_type: 'verified',
        first_source: 'discord_verification',
        latest_source: 'discord_verification',
        transition_count: 1,
        has_multi_step: false,
        transitions: [
          expect.objectContaining({
            sequence: 1,
            type: 'verified',
            source: 'discord_verification',
            actor: 'tester',
            final_library_id: 7
          })
        ]
      })
    );
    expect(updatedMetadata.classification_details.rag_loop_summary).toEqual(
      expect.objectContaining({
        linked_outcome_type: 'verified',
        linked_outcome_source: 'discord_verification',
        linked_outcome_first_type: 'verified',
        linked_outcome_transition_count: 1,
        linked_outcome_updated_at: expect.any(String)
      })
    );
  });

  test('merges nested routing details onto an existing outcome link', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{
          metadata: {
            classification_details: {
              outcome_link: {
                type: 'resolved',
                source: 'policy_question',
                actor: 'admin',
                recorded_at: '2026-03-21T10:00:00.000Z'
              }
            }
          }
        }]
      })
      .mockResolvedValueOnce({ rows: [] });

    await service.recordOutcome(321, {
      routing: {
        routed: false,
        reason: 'routing_skipped'
      }
    });

    const updatedMetadata = JSON.parse(db.query.mock.calls[1][1][1]);
    expect(updatedMetadata.classification_details.outcome_link).toEqual(
      expect.objectContaining({
        type: 'resolved',
        source: 'policy_question',
        actor: 'admin',
        recorded_at: '2026-03-21T10:00:00.000Z',
        updated_at: expect.any(String),
        routing: {
          routed: false,
          reason: 'routing_skipped'
        }
      })
    );
    expect(updatedMetadata.classification_details.outcome_path).toEqual(
      expect.objectContaining({
        transition_count: 1,
        has_multi_step: false,
        latest_outcome: expect.objectContaining({
          type: 'resolved',
          source: 'policy_question',
          routing: {
            routed: false,
            reason: 'routing_skipped'
          }
        })
      })
    );
  });

  test('stores a validated candidate-set attribution outside the mutable outcome path', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ metadata: { classification_details: {} } }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await service.recordOutcome(456, {
      type: 'resolved',
      source: 'policy_question',
      final_library_id: 8,
      current_library_candidate_retrieval_outcome_attribution: {
        version: 'current_library.candidate_retrieval_outcome_attribution.v1',
        statusId: 'changed_outside_candidates',
        destinationLibraryId: 8,
        destinationLibraryName: 'Private Library',
      },
    });

    const updatedMetadata = JSON.parse(db.query.mock.calls[1][1][1]);
    expect(updatedMetadata.classification_details.current_library_candidate_retrieval_outcome_attribution)
      .toEqual({
        version: 'current_library.candidate_retrieval_outcome_attribution.v1',
        status_id: 'changed_outside_candidates',
      });
    expect(JSON.stringify(updatedMetadata.classification_details.outcome_path))
      .not.toContain('current_library_candidate_retrieval_outcome_attribution');
    expect(JSON.stringify(updatedMetadata)).not.toContain('Private Library');
  });

  test('stores only the fixed contrastive status and selection outcome outside the mutable path', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ metadata: { classification_details: {} } }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await service.recordOutcome(456, {
      type: 'resolved',
      source: 'policy_question',
      final_library_id: 8,
      policy_candidate_contrastive_outcome_attribution: {
        version: 'policy.candidate_contrastive_outcome_attribution.v1',
        contrastiveStatusId: 'alternative_identity_match',
        selectionStatusId: 'changed_outside_candidates',
        destinationLibraryId: 8,
        candidateLibraryIds: [4, 8],
        catalogTitle: 'Private catalog title',
      },
    });

    const updatedMetadata = JSON.parse(db.query.mock.calls[1][1][1]);
    expect(updatedMetadata.classification_details.policy_candidate_contrastive_outcome_attribution)
      .toEqual({
        version: 'policy.candidate_contrastive_outcome_attribution.v1',
        contrastive_status_id: 'alternative_identity_match',
        selection_status_id: 'changed_outside_candidates',
      });
    expect(JSON.stringify(updatedMetadata.classification_details.outcome_path))
      .not.toContain('policy_candidate_contrastive_outcome_attribution');
    expect(JSON.stringify(updatedMetadata)).not.toContain('Private catalog title');
  });

  test('stores only fixed correction-analytics dimensions outside the mutable outcome path', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ metadata: { classification_details: {} } }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await service.recordOutcome(456, {
      type: 'resolved',
      source: 'policy_question',
      final_library_id: 8,
      policy_candidate_correction_outcome_attribution: {
        version: 'policy.candidate_correction_outcome_attribution.v1',
        scoreMarginBandId: '5_to_14',
        selectionStatusId: 'changed_outside_candidates',
        evidenceSourceStates: [
          { source_id: 'item_identity', state_id: 'anchored' },
          { source_id: 'declared_policy', state_id: 'supporting' },
          { source_id: 'observed_library_profile', state_id: 'contextual' },
          { source_id: 'similar_item_retrieval', state_id: 'supporting' },
          { source_id: 'confirmed_outcomes', state_id: 'supporting' },
        ],
        destinationLibraryId: 8,
        providerResponse: 'Private provider response',
        ragText: 'Private RAG passage',
      },
    });

    const updatedMetadata = JSON.parse(db.query.mock.calls[1][1][1]);
    expect(updatedMetadata.classification_details.policy_candidate_correction_outcome_attribution)
      .toEqual({
        version: 'policy.candidate_correction_outcome_attribution.v1',
        score_margin_band_id: '5_to_14',
        selection_status_id: 'changed_outside_candidates',
        evidence_source_states: [
          { source_id: 'item_identity', state_id: 'anchored' },
          { source_id: 'declared_policy', state_id: 'supporting' },
          { source_id: 'observed_library_profile', state_id: 'contextual' },
          { source_id: 'similar_item_retrieval', state_id: 'supporting' },
          { source_id: 'confirmed_outcomes', state_id: 'supporting' },
        ],
      });
    expect(JSON.stringify(updatedMetadata.classification_details.outcome_path))
      .not.toContain('policy_candidate_correction_outcome_attribution');
    expect(JSON.stringify(updatedMetadata)).not.toContain('Private provider response');
    expect(JSON.stringify(updatedMetadata)).not.toContain('Private RAG passage');
  });

  test('appends a new transition when the outcome type changes', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{
          metadata: {
            classification_details: {
              outcome_link: {
                type: 'resolved',
                source: 'policy_question',
                actor: 'admin',
                final_library_id: 8,
                recorded_at: '2026-03-21T10:00:00.000Z',
                updated_at: '2026-03-21T10:00:00.000Z'
              },
              outcome_path: {
                first_outcome: {
                  type: 'resolved',
                  source: 'policy_question',
                  actor: 'admin',
                  final_library_id: 8,
                  recorded_at: '2026-03-21T10:00:00.000Z',
                  updated_at: '2026-03-21T10:00:00.000Z'
                },
                latest_outcome: {
                  type: 'resolved',
                  source: 'policy_question',
                  actor: 'admin',
                  final_library_id: 8,
                  recorded_at: '2026-03-21T10:00:00.000Z',
                  updated_at: '2026-03-21T10:00:00.000Z'
                },
                transitions: [{
                  sequence: 1,
                  type: 'resolved',
                  source: 'policy_question',
                  actor: 'admin',
                  final_library_id: 8,
                  recorded_at: '2026-03-21T10:00:00.000Z',
                  updated_at: '2026-03-21T10:00:00.000Z'
                }],
                first_type: 'resolved',
                latest_type: 'resolved',
                transition_count: 1,
                has_multi_step: false
              }
            }
          }
        }]
      })
      .mockResolvedValueOnce({ rows: [] });

    await service.recordOutcome(654, {
      type: 'corrected',
      source: 'api_correction',
      actor: 'reviewer',
      final_library_id: 9
    });

    const updatedMetadata = JSON.parse(db.query.mock.calls[1][1][1]);
    expect(updatedMetadata.classification_details.outcome_link).toEqual(
      expect.objectContaining({
        type: 'corrected',
        source: 'api_correction',
        actor: 'reviewer',
        final_library_id: 9
      })
    );
    expect(updatedMetadata.classification_details.outcome_path).toEqual(
      expect.objectContaining({
        first_type: 'resolved',
        latest_type: 'corrected',
        transition_count: 2,
        has_multi_step: true,
        transitions: [
          expect.objectContaining({
            sequence: 1,
            type: 'resolved',
            source: 'policy_question'
          }),
          expect.objectContaining({
            sequence: 2,
            type: 'corrected',
            source: 'api_correction',
            actor: 'reviewer',
            final_library_id: 9
          })
        ]
      })
    );
  });

  test('updates an identical native pending-route transition without duplicating it', async () => {
    const existingRoute = {
      type: 'native_pending_route',
      source: 'policy_request_time',
      event_type_id: 'route_succeeded',
      final_library_id: 9,
      final_library_name: 'Animated Movies',
      route_result: {
        attempted: true,
        succeeded: true,
        missing_mapping: false,
        reason_code: null,
      },
      recorded_at: '2026-07-25T10:00:00.000Z',
      updated_at: '2026-07-25T10:00:00.000Z',
      sequence: 1,
    };
    db.query
      .mockResolvedValueOnce({
        rows: [{
          metadata: {
            classification_details: {
              outcome_link: existingRoute,
              outcome_path: {
                first_outcome: existingRoute,
                latest_outcome: existingRoute,
                transitions: [existingRoute],
                first_type: 'native_pending_route',
                latest_type: 'native_pending_route',
                transition_count: 1,
                has_multi_step: false,
              },
            },
          },
        }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await service.recordOutcome(777, {
      type: 'native_pending_route',
      source: 'policy_request_time',
      event_type_id: 'route_succeeded',
      final_library_id: 9,
      final_library_name: 'Animated Movies',
      route_result: {
        attempted: true,
        succeeded: true,
        missing_mapping: false,
        reason_code: null,
      },
    });

    const updatedMetadata = JSON.parse(db.query.mock.calls[1][1][1]);
    expect(updatedMetadata.classification_details.outcome_path).toEqual(
      expect.objectContaining({
        transition_count: 1,
        has_multi_step: false,
        transitions: [expect.objectContaining({
          type: 'native_pending_route',
          source: 'policy_request_time',
          final_library_id: 9,
          sequence: 1,
        })],
      }),
    );
  });
});
