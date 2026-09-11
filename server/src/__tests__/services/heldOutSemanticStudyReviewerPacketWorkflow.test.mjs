/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  createHeldOutSemanticStudyReviewerPacketWorkflow,
  HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_WORKFLOW_STATUS_IDS as STATUS_IDS,
} from '../../services/heldOutSemanticStudyReviewerPacketWorkflow.mjs';

const ready = Object.freeze({
  measuredBlockerId: 'private_cohort_capture_ready',
  privateCohortCaptureReady: true,
  statusId: 'eligibility_audit_available',
});

describe('held-out semantic study reviewer packet workflow', () => {
  test('requires the current aggregate handoff and emits only a non-content receipt', async () => {
    const packet = Object.freeze({ packetId: `review_packet_${'a'.repeat(64)}`, sensitive: 'private-title' });
    const evaluationBundle = Object.freeze({ version: 'redacted-bundle' });
    const scoringInput = Object.freeze({ sensitive: 'private-scoring-input', version: 'scoring-input' });
    const reviewerTemplates = Object.freeze({
      reviewerOne: Object.freeze({ submissionId: 'reviewer-one' }),
      reviewerTwo: Object.freeze({ submissionId: 'reviewer-two' }),
    });
    const createPacket = jest.fn(() => packet);
    const createEvaluationBundle = jest.fn(() => evaluationBundle);
    const createReviewerTemplatePair = jest.fn(() => reviewerTemplates);
    const createScoringInput = jest.fn(() => scoringInput);
    const cohortCapture = {
      captureForPrivateReviewerPacket: jest.fn(async ({ buildPacket, buildScoringInput }) => {
        expect(buildPacket({ privateReviewCases: [] })).toBe(packet);
        expect(buildScoringInput({ privateReviewCases: [] })).toBe(scoringInput);
        return {
          bundle: { manifest: { fixtureDocumentFingerprint: `sha256:${'b'.repeat(64)}` } },
          reviewerPacket: packet,
          scoringInput,
          status: { id: 'captured_pending_independent_labels' },
        };
      }),
    };
    const writeBundle = jest.fn(async () => undefined);
    const writePacket = jest.fn(async () => undefined);
    const writeReviewerTemplate = jest.fn(async () => undefined);
    const writeScoringInput = jest.fn(async () => undefined);
    const workflow = createHeldOutSemanticStudyReviewerPacketWorkflow({
      cohortCapture,
      createEvaluationBundle,
      createPacket,
      createReviewerTemplatePair,
      createScoringInput,
      now: () => new Date('2026-09-10T12:00:00.000Z'),
      readReadiness: jest.fn(async () => ready),
      writeBundle,
      writePacket,
      writeReviewerTemplate,
      writeScoringInput,
    });

    const result = await workflow.create({
      bundleOutputFile: '.tmp/reviewers/packet.evaluation-bundle.json',
      outputFile: '.tmp/reviewers/packet.json',
      reviewerOneTemplateOutputFile: '.tmp/reviewers/packet.reviewer-one-template.json',
      reviewerTwoTemplateOutputFile: '.tmp/reviewers/packet.reviewer-two-template.json',
      scoringInputOutputFile: '.tmp/reviewers/packet.scoring-input.json',
    });

    expect(result.status.id).toBe(STATUS_IDS.PACKET_CREATED);
    expect(result.receipt).toEqual({
      evaluationBundlePrepared: true,
      fixtureDocumentFingerprint: `sha256:${'b'.repeat(64)}`,
      packetPrepared: true,
      packetId: packet.packetId,
      reviewerTemplatesPrepared: true,
      scoringInputPrepared: true,
      statusId: 'captured_pending_independent_labels',
    });
    expect(JSON.stringify(result)).not.toContain('private-title');
    expect(writeBundle).toHaveBeenCalledWith('.tmp/reviewers/packet.evaluation-bundle.json', evaluationBundle);
    expect(writePacket).toHaveBeenCalledWith('.tmp/reviewers/packet.json', packet);
    expect(writeReviewerTemplate).toHaveBeenCalledWith(
      '.tmp/reviewers/packet.reviewer-one-template.json', reviewerTemplates.reviewerOne,
    );
    expect(writeReviewerTemplate).toHaveBeenCalledWith(
      '.tmp/reviewers/packet.reviewer-two-template.json', reviewerTemplates.reviewerTwo,
    );
    expect(writeScoringInput).toHaveBeenCalledWith('.tmp/reviewers/packet.scoring-input.json', scoringInput);
  });

  test('does not select, capture, or write when the aggregate handoff is absent', async () => {
    const cohortCapture = { captureForPrivateReviewerPacket: jest.fn() };
    const writeBundle = jest.fn();
    const writePacket = jest.fn();
    const writeReviewerTemplate = jest.fn();
    const writeScoringInput = jest.fn();
    const workflow = createHeldOutSemanticStudyReviewerPacketWorkflow({
      cohortCapture,
      readReadiness: async () => ({ ...ready, privateCohortCaptureReady: false }),
      writeBundle,
      writePacket,
      writeReviewerTemplate,
      writeScoringInput,
    });

    await expect(workflow.create({
      bundleOutputFile: '.tmp/reviewers/packet.evaluation-bundle.json',
      outputFile: '.tmp/reviewers/packet.json',
      reviewerOneTemplateOutputFile: '.tmp/reviewers/packet.reviewer-one-template.json',
      reviewerTwoTemplateOutputFile: '.tmp/reviewers/packet.reviewer-two-template.json',
      scoringInputOutputFile: '.tmp/reviewers/packet.scoring-input.json',
    })).resolves.toMatchObject({
      status: { id: STATUS_IDS.NOT_READY },
      receipt: null,
    });
    expect(cohortCapture.captureForPrivateReviewerPacket).not.toHaveBeenCalled();
    expect(writeBundle).not.toHaveBeenCalled();
    expect(writePacket).not.toHaveBeenCalled();
    expect(writeReviewerTemplate).not.toHaveBeenCalled();
    expect(writeScoringInput).not.toHaveBeenCalled();
  });

  test('reports a write failure without exposing the packet', async () => {
    const packet = { packetId: `review_packet_${'c'.repeat(64)}`, title: 'private' };
    const scoringInput = { title: 'private scorer input' };
    const reviewerTemplates = {
      reviewerOne: { submissionId: 'reviewer-one' },
      reviewerTwo: { submissionId: 'reviewer-two' },
    };
    const workflow = createHeldOutSemanticStudyReviewerPacketWorkflow({
      cohortCapture: {
        captureForPrivateReviewerPacket: async () => ({
          bundle: { manifest: { fixtureDocumentFingerprint: `sha256:${'d'.repeat(64)}` } },
          reviewerPacket: packet,
          scoringInput,
          status: { id: 'captured_pending_independent_labels' },
        }),
      },
      createEvaluationBundle: () => ({ version: 'redacted-bundle' }),
      createReviewerTemplatePair: () => reviewerTemplates,
      createScoringInput: () => scoringInput,
      readReadiness: async () => ready,
      writeBundle: async () => undefined,
      writePacket: async () => { throw new Error('write failure'); },
      writeReviewerTemplate: async () => undefined,
      writeScoringInput: async () => undefined,
    });

    const result = await workflow.create({
      bundleOutputFile: '.tmp/reviewers/packet.evaluation-bundle.json',
      outputFile: '.tmp/reviewers/packet.json',
      reviewerOneTemplateOutputFile: '.tmp/reviewers/packet.reviewer-one-template.json',
      reviewerTwoTemplateOutputFile: '.tmp/reviewers/packet.reviewer-two-template.json',
      scoringInputOutputFile: '.tmp/reviewers/packet.scoring-input.json',
    });
    expect(result.status.id).toBe(STATUS_IDS.PACKET_WRITE_FAILED);
    expect(result.receipt.evaluationBundlePrepared).toBe(true);
    expect(result.receipt.scoringInputPrepared).toBe(true);
    expect(result.receipt.reviewerTemplatesPrepared).toBe(true);
    expect(JSON.stringify(result)).not.toContain('private');
  });

  test('does not write the private packet when the redacted companion cannot be written', async () => {
    const writePacket = jest.fn();
    const writeReviewerTemplate = jest.fn();
    const writeScoringInput = jest.fn();
    const workflow = createHeldOutSemanticStudyReviewerPacketWorkflow({
      cohortCapture: {
        captureForPrivateReviewerPacket: async () => ({
          bundle: { manifest: { fixtureDocumentFingerprint: `sha256:${'e'.repeat(64)}` } },
          reviewerPacket: { packetId: `review_packet_${'f'.repeat(64)}`, title: 'private' },
          scoringInput: { title: 'private scorer input' },
          status: { id: 'captured_pending_independent_labels' },
        }),
      },
      createEvaluationBundle: () => ({ version: 'redacted-bundle' }),
      createReviewerTemplatePair: () => ({
        reviewerOne: { submissionId: 'reviewer-one' },
        reviewerTwo: { submissionId: 'reviewer-two' },
      }),
      createScoringInput: () => ({ title: 'private scorer input' }),
      readReadiness: async () => ready,
      writeBundle: async () => { throw new Error('bundle write failure'); },
      writePacket,
      writeReviewerTemplate,
      writeScoringInput,
    });

    const result = await workflow.create({
      bundleOutputFile: '.tmp/reviewers/packet.evaluation-bundle.json',
      outputFile: '.tmp/reviewers/packet.json',
      reviewerOneTemplateOutputFile: '.tmp/reviewers/packet.reviewer-one-template.json',
      reviewerTwoTemplateOutputFile: '.tmp/reviewers/packet.reviewer-two-template.json',
      scoringInputOutputFile: '.tmp/reviewers/packet.scoring-input.json',
    });

    expect(result.status.id).toBe(STATUS_IDS.EVALUATION_BUNDLE_WRITE_FAILED);
    expect(result.receipt.evaluationBundlePrepared).toBe(false);
    expect(JSON.stringify(result)).not.toContain('private');
    expect(writePacket).not.toHaveBeenCalled();
    expect(writeReviewerTemplate).not.toHaveBeenCalled();
    expect(writeScoringInput).not.toHaveBeenCalled();
  });

  test('does not write the packet when the first independent worksheet cannot be written', async () => {
    const writePacket = jest.fn();
    const writeReviewerTemplate = jest.fn(async () => { throw new Error('template write failure'); });
    const workflow = createHeldOutSemanticStudyReviewerPacketWorkflow({
      cohortCapture: {
        captureForPrivateReviewerPacket: async () => ({
          bundle: { manifest: { fixtureDocumentFingerprint: `sha256:${'a'.repeat(64)}` } },
          reviewerPacket: { packetId: `review_packet_${'b'.repeat(64)}`, title: 'private' },
          scoringInput: { title: 'private scorer input' },
          status: { id: 'captured_pending_independent_labels' },
        }),
      },
      createEvaluationBundle: () => ({ version: 'redacted-bundle' }),
      createReviewerTemplatePair: () => ({
        reviewerOne: { submissionId: 'reviewer-one' },
        reviewerTwo: { submissionId: 'reviewer-two' },
      }),
      createScoringInput: () => ({ title: 'private scorer input' }),
      readReadiness: async () => ready,
      writeBundle: async () => undefined,
      writePacket,
      writeReviewerTemplate,
      writeScoringInput: async () => undefined,
    });

    const result = await workflow.create({
      bundleOutputFile: '.tmp/reviewers/packet.evaluation-bundle.json',
      outputFile: '.tmp/reviewers/packet.json',
      reviewerOneTemplateOutputFile: '.tmp/reviewers/packet.reviewer-one-template.json',
      reviewerTwoTemplateOutputFile: '.tmp/reviewers/packet.reviewer-two-template.json',
      scoringInputOutputFile: '.tmp/reviewers/packet.scoring-input.json',
    });

    expect(result.status.id).toBe(STATUS_IDS.REVIEWER_ONE_TEMPLATE_WRITE_FAILED);
    expect(result.receipt.reviewerTemplatesPrepared).toBe(false);
    expect(writePacket).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('private');
  });

  test('fails closed when worksheet preparation throws', async () => {
    const writeBundle = jest.fn();
    const writePacket = jest.fn();
    const writeReviewerTemplate = jest.fn();
    const workflow = createHeldOutSemanticStudyReviewerPacketWorkflow({
      cohortCapture: {
        captureForPrivateReviewerPacket: async () => ({
          bundle: { manifest: { fixtureDocumentFingerprint: `sha256:${'c'.repeat(64)}` } },
          reviewerPacket: { packetId: `review_packet_${'d'.repeat(64)}`, title: 'private' },
          scoringInput: { title: 'private scorer input' },
          status: { id: 'captured_pending_independent_labels' },
        }),
      },
      createReviewerTemplatePair: () => { throw new Error('template preparation failure'); },
      readReadiness: async () => ready,
      writeBundle,
      writePacket,
      writeReviewerTemplate,
      writeScoringInput: jest.fn(),
    });

    const result = await workflow.create({
      bundleOutputFile: '.tmp/reviewers/packet.evaluation-bundle.json',
      outputFile: '.tmp/reviewers/packet.json',
      reviewerOneTemplateOutputFile: '.tmp/reviewers/packet.reviewer-one-template.json',
      reviewerTwoTemplateOutputFile: '.tmp/reviewers/packet.reviewer-two-template.json',
      scoringInputOutputFile: '.tmp/reviewers/packet.scoring-input.json',
    });

    expect(result.status.id).toBe(STATUS_IDS.REVIEWER_TEMPLATES_PREPARATION_FAILED);
    expect(writeBundle).not.toHaveBeenCalled();
    expect(writePacket).not.toHaveBeenCalled();
    expect(writeReviewerTemplate).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('private');
  });
});
