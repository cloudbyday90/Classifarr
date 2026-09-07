/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, test, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import FeedbackEvaluationCoverage from '../components/stats/FeedbackEvaluationCoverage.vue'
import PolicyStatsCard from '../components/stats/PolicyStatsCard.vue'
import PolicyStatsModal from '../components/stats/PolicyStatsModal.vue'

const { detail, comparison } = vi.hoisted(() => ({ detail: vi.fn(), comparison: vi.fn() }))
vi.mock('../api', () => ({ default: { getPolicyStatsDetail: detail, getPolicyStatsComparison: comparison } }))

describe('feedback evaluation coverage', () => {
  test('explains the measured denominator while preserving all observation totals', () => {
    const wrapper = mount(FeedbackEvaluationCoverage, { props: { stats: { evaluated_decisions: 2, total_decisions: 10 } } })
    expect(wrapper.text()).toContain('Accuracy uses 2 of 10 recorded decisions')
    expect(wrapper.text()).toContain('Unevaluated observations remain in the activity totals')
    wrapper.unmount()
  })

  test.each([null, 0, 1])('renders unavailable, zero and perfect evaluated accuracy distinctly: %s', accuracy => {
    const wrapper = mount(PolicyStatsCard, { props: { policy: { name: 'Movies', accuracy_rate: accuracy,
      total_decisions: 10, evaluated_decisions: 2, evaluation_coverage: 0.2 } } })
    expect(wrapper.text()).toContain('20.0%')
    expect(wrapper.text()).toContain('2 of 10 decisions')
    const value = wrapper.findAll('.stat').find(stat => stat.find('.label').text() === 'Accuracy').find('.value')
    expect(value.text()).toBe(accuracy === null ? 'N/A' : `${accuracy * 100}.0%`)
    expect(value.classes()).toContain(accuracy === 0 ? 'low' : accuracy === 1 ? 'high' : 'value')
    wrapper.unmount()
  })

  test('exposes details as a native button with no nested interactive controls', async () => {
    const policy = { id: 3, name: 'Movies' }
    const wrapper = mount(PolicyStatsCard, { props: { policy } })
    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.attributes('type')).toBe('button')
    expect(wrapper.element.querySelectorAll('button, a, input')).toHaveLength(0)
    await wrapper.trigger('click')
    expect(wrapper.emitted('view-details')).toEqual([[policy]])
    wrapper.unmount()
  })

  test('detail view shows coverage and does not render unknown accuracy as a success', async () => {
    detail.mockResolvedValue({ total_decisions: 8, evaluated_decisions: 0, evaluation_coverage: 0,
      accuracy_rate: null, auto_accuracy_rate: null, user_corrections: 0 })
    comparison.mockResolvedValue([])
    const wrapper = mount(PolicyStatsModal, { props: { policy: { id: 3, name: 'Movies' } } })
    await flushPromises()
    expect(wrapper.text()).toContain('Accuracy uses 0 of 8 recorded decisions')
    const metrics = wrapper.findAll('.metric-box')
    expect(metrics.find(item => item.text().includes('Overall Accuracy')).text()).toContain('N/A')
    expect(metrics.find(item => item.text().includes('Evaluated Coverage')).text()).toContain('0.0%')
    wrapper.unmount()
  })
})
