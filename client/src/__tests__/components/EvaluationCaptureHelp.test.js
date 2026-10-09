/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EvaluationCaptureHelp from '@/components/command-center/EvaluationCaptureHelp.vue'

it('offers collapsed static instructions and only a read-only command', () => {
  const wrapper = mount(EvaluationCaptureHelp)
  expect(wrapper.get('details').attributes('open')).toBeUndefined()
  expect(wrapper.get('summary').text()).toBe('How to check AI-response capture')
  expect(wrapper.get('code').text()).toBe('node /app/src/scripts/runOperatorCorrectionPolicyEvaluation.mjs --source-pair-ai-budget-status')
  expect(wrapper.text()).toContain('does not enable capture')
  expect(wrapper.text()).toContain('requires an administrator to opt in')
  expect(wrapper.text()).not.toMatch(/--configure|--capture-source-pair-ai/)
  expect(wrapper.find('button, input, [aria-live], [autofocus]').exists()).toBe(false)
  expect(wrapper.get('a').attributes()).toMatchObject({
    href: 'https://github.com/cloudbyday90/Classifarr/blob/main/docs/operations/evaluation-ai-capture.md',
    target: '_blank', rel: 'noopener noreferrer',
  })
  expect(wrapper.get('a').text()).toContain('opens in a new tab')
})
