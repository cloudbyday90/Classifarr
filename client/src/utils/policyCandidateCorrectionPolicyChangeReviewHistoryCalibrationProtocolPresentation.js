const STATUS_IDS = Object.freeze({
  AWAITING_AGGREGATE_EVIDENCE: 'awaiting_aggregate_evidence',
  REVIEW_PROCESS_FOLLOW_UP_REQUIRED: 'review_process_follow_up_required',
  READY_FOR_OFFLINE_PROTOCOL: 'ready_for_offline_protocol',
})

const PROTOCOL_ID = 'aggregate_synthetic_fixed_bands_v1'
const PROPOSAL_PACKET_VERSION = 'policy.candidate_correction_policy_change_human_review_packet.v1'
const PROCEDURE_IDS = Object.freeze([
  'freeze_aggregate_snapshot',
  'run_checked_in_synthetic_fixture_suite',
  'compare_fixed_policy_bands',
  'prepare_human_approval_packet',
])

const EXPECTED_PROTOCOL_AVAILABILITY = Object.freeze({
  [STATUS_IDS.AWAITING_AGGREGATE_EVIDENCE]: false,
  [STATUS_IDS.REVIEW_PROCESS_FOLLOW_UP_REQUIRED]: false,
  [STATUS_IDS.READY_FOR_OFFLINE_PROTOCOL]: true,
})

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function hasExpectedProcedureIds(value) {
  return Array.isArray(value) && value.length === PROCEDURE_IDS.length &&
    value.every((procedureId, index) => procedureId === PROCEDURE_IDS[index])
}

/** Drops unknown fields and rejects a protocol state that claims automatic authority. */
export function normalizePolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocol(value) {
  const source = asPlainObject(value)
  if (!source || !Object.hasOwn(EXPECTED_PROTOCOL_AVAILABILITY, source.statusId) ||
      source.protocolAvailable !== EXPECTED_PROTOCOL_AVAILABILITY[source.statusId] ||
      source.humanApprovalRequired !== true || source.proposalGenerated !== false ||
      source.automaticPolicyChange !== false || source.automaticAiRagTuning !== false ||
      source.routingChanged !== false) {
    return null
  }
  const protocolAvailable = source.protocolAvailable
  if ((protocolAvailable && (source.protocolId !== PROTOCOL_ID ||
      source.proposalPacketVersion !== PROPOSAL_PACKET_VERSION || !hasExpectedProcedureIds(source.procedureIds))) ||
      (!protocolAvailable && (source.protocolId !== null || source.proposalPacketVersion !== null ||
      !Array.isArray(source.procedureIds) || source.procedureIds.length !== 0))) {
    return null
  }
  return Object.freeze({
    statusId: source.statusId,
    protocolAvailable,
    procedureIds: Object.freeze(protocolAvailable ? [...PROCEDURE_IDS] : []),
  })
}

const PRESENTATION = Object.freeze({
  [STATUS_IDS.AWAITING_AGGREGATE_EVIDENCE]: Object.freeze({
    heading: 'Offline calibration protocol is waiting for aggregate evidence',
    message: 'The human procedure stays unavailable until six complete, sufficiently active aggregate periods are ready.',
    statusClass: 'text-gray-300',
  }),
  [STATUS_IDS.REVIEW_PROCESS_FOLLOW_UP_REQUIRED]: Object.freeze({
    heading: 'Offline calibration protocol needs review-process follow-up',
    message: 'Aggregate evidence is ready, but the current review process is not consistent enough to begin a controlled calibration evaluation.',
    statusClass: 'text-amber-300',
  }),
  [STATUS_IDS.READY_FOR_OFFLINE_PROTOCOL]: Object.freeze({
    heading: 'Offline calibration protocol is ready for human evaluation',
    message: 'Follow the fixed aggregate-and-synthetic procedure below. Classifarr will not generate a proposal or change policy, AI, RAG, or routing.',
    statusClass: 'text-blue-300',
  }),
})

const PROCEDURE_LABELS = Object.freeze({
  freeze_aggregate_snapshot: 'Freeze an operator-held aggregate snapshot for the review record.',
  run_checked_in_synthetic_fixture_suite: 'Run the checked-in synthetic fixture suite outside live routing.',
  compare_fixed_policy_bands: 'Compare the fixed policy bands and document the result.',
  prepare_human_approval_packet: 'Prepare a human approval packet; do not apply a change automatically.',
})

export function getPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocolPresentation(statusId) {
  return PRESENTATION[statusId] || null
}

export function presentPolicyCandidateCorrectionPolicyChangeReviewHistoryCalibrationProtocolProcedure(procedureId) {
  return PROCEDURE_LABELS[procedureId] || null
}

export { STATUS_IDS as POLICY_CANDIDATE_CORRECTION_POLICY_CHANGE_REVIEW_HISTORY_CALIBRATION_PROTOCOL_STATUS_IDS }
