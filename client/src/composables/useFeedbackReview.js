/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { computed, ref, unref, watch, onScopeDispose } from 'vue'
import api from '@/api'
import { feedbackReviewClassificationId, normalizeFeedbackReview, normalizeFeedbackReviewReceipt,
  readPendingFeedbackReview, storePendingFeedbackReview, clearPendingFeedbackReview } from '@/utils/feedbackReview'

export function useFeedbackReview(classificationId, { steadyNow = () => performance.now() } = {}) {
  const preview = ref(null), pending = ref(null), phase = ref('idle'), message = ref(''), warning = ref(''), tick = ref(0)
  const id = computed(() => feedbackReviewClassificationId(unref(classificationId)))
  let generation = 0, started = 0
  const timer = setInterval(() => { tick.value++ }, 1000)
  onScopeDispose(() => { generation++; clearInterval(timer) })
  const expired = computed(() => { void tick.value; return Boolean(preview.value && steadyNow() - started >= 600000) })
  const busy = computed(() => ['preparing', 'sending', 'checking'].includes(phase.value))
  const canSubmit = computed(() => phase.value === 'reviewing' && preview.value && !expired.value)
  const current = (request, classId) => request === generation && classId === id.value
  const unavailable = error => error?.response?.data?.code === 'FEEDBACK_SOURCE_CONFLICT'
    ? 'Feedback is already recorded for this event. This review did not add another vote.'
    : [401, 403].includes(error?.response?.status)
    ? 'An active administrator account is required. Sign in again before reviewing.'
    : 'This review is unavailable or changed. No new review was prepared. Try again when the source is ready.'
  function recorded(text = 'Feedback was recorded. The recorded outcome and media location were not changed.') {
    clearPendingFeedbackReview(id.value); pending.value = null; phase.value = 'recorded'; message.value = text
  }
  function close() { generation++; preview.value = null; phase.value = pending.value ? 'unknown' : 'idle'; message.value = '' }
  async function check() {
    if (!pending.value || busy.value) return
    const request = ++generation, classId = id.value, command = pending.value.command
    phase.value = 'checking'; message.value = 'Checking the committed feedback receipt…'
    try {
      const receipt = normalizeFeedbackReviewReceipt(await api.getFeedbackReviewReceipt(classId, command.reviewId), classId, command.reviewId)
      if (!current(request, classId)) return
      if (receipt?.status === 'recorded') { recorded(receipt.feedbackId === null ? 'The feedback submission was recorded; its feedback row is no longer available.' : undefined); return }
      phase.value = 'unknown'; message.value = 'No verified receipt is visible yet. This does not prove failure. Check again or retry the same submission.'
    } catch {
      if (current(request, classId)) { phase.value = 'unknown'; message.value = 'Receipt lookup is unavailable. The submission outcome remains unknown.' }
    }
  }
  async function open() {
    generation++; preview.value = null; message.value = ''; warning.value = ''
    pending.value = id.value ? readPendingFeedbackReview(id.value) ??
      (pending.value?.classificationId === id.value ? pending.value : null) : null
    phase.value = pending.value ? 'unknown' : 'idle'
    if (pending.value) { await check(); return }
    await prepare()
  }
  async function prepare() {
    if (!id.value || busy.value || pending.value) return
    const request = ++generation, classId = id.value; started = steadyNow()
    phase.value = 'preparing'; message.value = 'Preparing the original automated destination for review…'
    try {
      const value = normalizeFeedbackReview((await api.prepareFeedbackReview(classId)).data, classId)
      if (!current(request, classId)) return
      if (!value) throw new Error('Invalid feedback review')
      preview.value = value; phase.value = 'reviewing'; message.value = 'Review the original destination, then choose an explicit feedback action.'
    } catch (error) {
      if (current(request, classId)) { preview.value = null; phase.value = 'unavailable'; message.value = unavailable(error) }
    }
  }
  async function send(command) {
    if (busy.value || !id.value) return
    const request = ++generation, classId = id.value, recovering = Boolean(pending.value)
    pending.value = { classificationId: classId, command }
    warning.value = storePendingFeedbackReview(pending.value) ? '' : 'This tab cannot retain recovery after reload. Keep this review open until its result is known.'
    phase.value = 'sending'; message.value = 'Recording this feedback assessment…'
    try {
      const result = (await api.submitFeedbackReview(classId, command)).data
      if (!current(request, classId)) return
      if (result?.reviewId !== command.reviewId || result.classificationId !== classId || !Number.isInteger(result.feedbackId) || result.feedbackId <= 0) throw new Error('Unverified feedback result')
      recorded()
    } catch (error) {
      if (!current(request, classId)) return
      if ([401, 403].includes(error?.response?.status)) {
        phase.value = 'unknown'; preview.value = null; message.value = 'Sign in with the same active administrator account, then check the receipt. The earlier submission outcome remains unknown.'
      } else if (!recovering && (error?.response?.status === 400 || ['FEEDBACK_REVIEW_CHANGED', 'FEEDBACK_SOURCE_CONFLICT'].includes(error?.response?.data?.code))) {
        clearPendingFeedbackReview(classId); pending.value = null; preview.value = null; phase.value = 'unavailable'; message.value = unavailable(error)
      } else {
        phase.value = 'unknown'; preview.value = null; message.value = 'The submission result is unverified. Check its receipt or retry this exact submission; do not choose a different destination.'
      }
    }
  }
  function submit(action, policyId) {
    const choice = preview.value?.choices.find(value => value.policyId === Number(policyId))
    if (!canSubmit.value || !choice || !['confirmation', 'correction'].includes(action) ||
      (action === 'confirmation') !== (choice.libraryId === preview.value.reference.libraryId)) return
    return send({ reviewId: preview.value.reviewId, action, selected_library_id: choice.libraryId, selected_policy_id: choice.policyId })
  }
  const retry = () => pending.value && send({ ...pending.value.command })
  watch(id, () => { close(); pending.value = null })
  return { preview, pending, phase, message, warning, busy, expired, canSubmit, open, close, prepare, submit, retry, check }
}
