/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const EVALUATION_FAILURE_STAGE = Object.freeze({
  LOCK: 'advisory_lock',
  STATE: 'state_read',
  ADMISSION: 'admission',
  SNAPSHOT: 'snapshot_read',
  QUALITY: 'quality_collection',
  EVALUATION: 'evaluation',
  RECHECK: 'snapshot_recheck',
  PUBLICATION: 'publication',
  FAILURE_RECORD: 'failure_record',
});

export const withoutStageObservation = (_stage, work) => work();

/** Keep only the innermost observation of the rejection actually propagated. */
export function createEvaluationFailureTrace() {
  let failure = null;
  return {
    async during(stage, work) {
      try {
        const result = await work();
        failure = null;
        return result;
      } catch (error) {
        if (!failure || !Object.is(error, failure.error)) failure = { error, stage };
        throw error;
      }
    },
    takeStage(error) {
      const stage = failure && Object.is(error, failure.error) ? failure.stage : null;
      failure = null;
      return stage;
    },
  };
}
