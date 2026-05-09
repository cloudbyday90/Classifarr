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
});
