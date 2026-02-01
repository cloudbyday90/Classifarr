/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import PolicyCard from '../components/policies/PolicyCard.vue';
import Card from '../components/common/Card.vue';
import Badge from '../components/common/Badge.vue';
import Button from '../components/common/Button.vue';

describe('PolicyCard.vue', () => {
  const mockPolicyWithPresets = {
    id: 1,
    name: 'Sci-Fi Movies Policy',
    library_name: 'Sci-Fi Movies',
    description: 'Test policy description',
    enabled: true,
    preset_count: 5,
    auto_classify_threshold: 85,
    prompt_threshold: 60,
    priority: 100,
    preset_weight: 0.4,
    pattern_weight: 0.3,
    rag_weight: 0.2,
    history_weight: 0.1
  };

  const mockPolicyEmpty = {
    id: 2,
    name: 'Action Movies Policy',
    library_name: 'Action Movies',
    enabled: true,
    preset_count: 0,
    auto_classify_threshold: 85,
    prompt_threshold: 60,
    priority: 50
  };

  describe('Rendering', () => {
    it('renders without crashing', () => {
      const wrapper = mount(PolicyCard, {
        props: { policy: mockPolicyWithPresets }
      });
      expect(wrapper.exists()).toBe(true);
    });

    it('displays library header with icon', () => {
      const wrapper = mount(PolicyCard, {
        props: { policy: mockPolicyWithPresets }
      });
      expect(wrapper.text()).toContain('📚');
      expect(wrapper.text()).toContain('Sci-Fi Movies');
    });

    it('displays policy name', () => {
      const wrapper = mount(PolicyCard, {
        props: { policy: mockPolicyWithPresets }
      });
      expect(wrapper.text()).toContain('Sci-Fi Movies Policy');
    });

    it('displays policy description when provided', () => {
      const wrapper = mount(PolicyCard, {
        props: { policy: mockPolicyWithPresets }
      });
      expect(wrapper.text()).toContain('Test policy description');
    });

    it('does not display description when not provided', () => {
      const policyWithoutDesc = { ...mockPolicyWithPresets, description: null };
      const wrapper = mount(PolicyCard, {
        props: { policy: policyWithoutDesc }
      });
      expect(wrapper.find('p.text-sm.text-gray-400').exists()).toBe(false);
    });
  });

  describe('Badge Display', () => {
    it('displays "Active" badge when policy is enabled', () => {
      const wrapper = mount(PolicyCard, {
        props: { policy: mockPolicyWithPresets }
      });
      const badges = wrapper.findAllComponents(Badge);
      const activeBadge = badges.find(b => b.text() === 'Active');
      expect(activeBadge).toBeDefined();
      expect(activeBadge.props('variant')).toBe('success');
    });

    it('displays "Disabled" badge when policy is not enabled', () => {
      const disabledPolicy = { ...mockPolicyWithPresets, enabled: false };
      const wrapper = mount(PolicyCard, {
        props: { policy: disabledPolicy }
      });
      const badges = wrapper.findAllComponents(Badge);
      const disabledBadge = badges.find(b => b.text() === 'Disabled');
      expect(disabledBadge).toBeDefined();
      expect(disabledBadge.props('variant')).toBe('default');
    });

    it('displays preset count badge when presets exist', () => {
      const wrapper = mount(PolicyCard, {
        props: { policy: mockPolicyWithPresets }
      });
      expect(wrapper.text()).toContain('5 presets');
    });

    it('does not display preset count badge when no presets', () => {
      const wrapper = mount(PolicyCard, {
        props: { policy: mockPolicyEmpty }
      });
      // Empty state shows "No presets configured" text, not a badge
      const badges = wrapper.findAllComponents(Badge);
      const presetBadge = badges.find(b => b.text().includes('presets'));
      expect(presetBadge).toBeUndefined();
    });
  });

  describe('Empty State', () => {
    it('displays empty state when preset_count is 0', () => {
      const wrapper = mount(PolicyCard, {
        props: { policy: mockPolicyEmpty }
      });
      expect(wrapper.text()).toContain('No presets configured');
      // Button text is checked in a separate test
    });

    it('displays dashed border container in empty state', () => {
      const wrapper = mount(PolicyCard, {
        props: { policy: mockPolicyEmpty }
      });
      const emptyState = wrapper.find('.border-dashed');
      expect(emptyState.exists()).toBe(true);
      expect(emptyState.classes()).toContain('border-2');
      // Also check for the specific failure case or ensure color matches if needed, but basic existence is fine
    });

    it('displays centered plus icon in empty state', () => {
      const wrapper = mount(PolicyCard, {
        props: { policy: mockPolicyEmpty }
      });
      // The icon is now inside a circle bg-primary/20
      const plusIcon = wrapper.find('.text-2xl.text-primary');
      expect(plusIcon.exists()).toBe(true);
      expect(plusIcon.text()).toBe('+');
    });

    it('displays "Configure" button in empty state', () => {
      const wrapper = mount(PolicyCard, {
        props: { policy: mockPolicyEmpty }
      });
      const configureButton = wrapper.findAllComponents(Button).find(b => b.text() === 'Configure');
      expect(configureButton).toBeDefined();
      expect(configureButton.props('variant')).toBe('primary');
    });

    it('displays threshold footer in empty state', () => {
      const wrapper = mount(PolicyCard, {
        props: { policy: mockPolicyEmpty }
      });
      expect(wrapper.text()).toContain('Auto-classify: ≥85%');
      expect(wrapper.text()).toContain('Prompt: ≥60%');
    });

    it('does not display empty state when presets exist', () => {
      const wrapper = mount(PolicyCard, {
        props: { policy: mockPolicyWithPresets }
      });
      expect(wrapper.text()).not.toContain('No presets configured');
    });
  });

  describe('Filled State', () => {
    it('displays thresholds when presets exist', () => {
      const wrapper = mount(PolicyCard, {
        props: { policy: mockPolicyWithPresets }
      });
      expect(wrapper.text()).toContain('Auto-classify:');
      expect(wrapper.text()).toContain('≥85%');
      expect(wrapper.text()).toContain('Prompt:');
      expect(wrapper.text()).toContain('≥60%');
    });

    it('displays priority when presets exist', () => {
      const wrapper = mount(PolicyCard, {
        props: { policy: mockPolicyWithPresets }
      });
      expect(wrapper.text()).toContain('Priority:');
      expect(wrapper.text()).toContain('100');
    });

    it('hides weights by default', () => {
      const wrapper = mount(PolicyCard, {
        props: { policy: mockPolicyWithPresets }
      });
      expect(wrapper.text()).not.toContain('Presets:');
      expect(wrapper.text()).not.toContain('40%');
    });

    it('shows weights when "Show Weights" button is clicked', async () => {
      const wrapper = mount(PolicyCard, {
        props: { policy: mockPolicyWithPresets }
      });
      const showWeightsButton = wrapper.findAllComponents(Button).find(b => b.text() === 'Show Weights');
      await showWeightsButton.trigger('click');

      expect(wrapper.text()).toContain('Presets:');
      expect(wrapper.text()).toContain('40%');
      expect(wrapper.text()).toContain('Patterns:');
      expect(wrapper.text()).toContain('30%');
      expect(wrapper.text()).toContain('RAG:');
      expect(wrapper.text()).toContain('20%');
      expect(wrapper.text()).toContain('History:');
      expect(wrapper.text()).toContain('10%');
    });

    it('toggles weights visibility', async () => {
      const wrapper = mount(PolicyCard, {
        props: { policy: mockPolicyWithPresets }
      });
      const showWeightsButton = wrapper.findAllComponents(Button).find(b => b.text() === 'Show Weights');

      // Show weights
      await showWeightsButton.trigger('click');
      expect(wrapper.text()).toContain('Presets:');

      // Hide weights
      const hideWeightsButton = wrapper.findAllComponents(Button).find(b => b.text() === 'Hide Weights');
      await hideWeightsButton.trigger('click');
      expect(wrapper.text()).not.toContain('Presets:');
    });
  });

  describe('Actions', () => {
    it('displays Configure button', () => {
      const wrapper = mount(PolicyCard, {
        props: { policy: mockPolicyWithPresets }
      });
      const configureButton = wrapper.findAllComponents(Button).find(b => b.text() === 'Configure');
      expect(configureButton).toBeDefined();
    });

    it('displays Reset button', () => {
      const wrapper = mount(PolicyCard, {
        props: { policy: mockPolicyWithPresets }
      });
      const resetButton = wrapper.findAllComponents(Button).find(b => b.text() === 'Reset');
      expect(resetButton).toBeDefined();
    });

    it('emits configure event when Configure button is clicked', async () => {
      const wrapper = mount(PolicyCard, {
        props: { policy: mockPolicyWithPresets }
      });
      const configureButton = wrapper.findAllComponents(Button).find(b => b.text() === 'Configure');
      await configureButton.trigger('click');

      expect(wrapper.emitted('configure')).toBeTruthy();
      expect(wrapper.emitted('configure')[0]).toEqual([mockPolicyWithPresets]);
    });

    it('emits delete event when Reset button is clicked', async () => {
      const wrapper = mount(PolicyCard, {
        props: { policy: mockPolicyWithPresets }
      });
      const resetButton = wrapper.findAllComponents(Button).find(b => b.text() === 'Reset');
      await resetButton.trigger('click');

      expect(wrapper.emitted('delete')).toBeTruthy();
      expect(wrapper.emitted('delete')[0]).toEqual([mockPolicyWithPresets]);
    });

    it('emits configure event when Configure button is clicked in empty state', async () => {
      const wrapper = mount(PolicyCard, {
        props: { policy: mockPolicyEmpty }
      });
      const configureButton = wrapper.findAllComponents(Button).find(b => b.text() === 'Configure');
      await configureButton.trigger('click');

      expect(wrapper.emitted('configure')).toBeTruthy();
      expect(wrapper.emitted('configure')[0]).toEqual([mockPolicyEmpty]);
    });

    it('shows "Show Weights" button only when presets exist', () => {
      const wrapperWithPresets = mount(PolicyCard, {
        props: { policy: mockPolicyWithPresets }
      });
      const wrapperEmpty = mount(PolicyCard, {
        props: { policy: mockPolicyEmpty }
      });

      expect(wrapperWithPresets.findAllComponents(Button).find(b => b.text() === 'Show Weights')).toBeDefined();
      expect(wrapperEmpty.findAllComponents(Button).find(b => b.text() === 'Show Weights')).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('handles missing preset_count gracefully', () => {
      const policyNoCount = { ...mockPolicyWithPresets };
      delete policyNoCount.preset_count;

      const wrapper = mount(PolicyCard, {
        props: { policy: policyNoCount }
      });
      expect(wrapper.exists()).toBe(true);
      expect(wrapper.text()).toContain('No presets configured');
    });

    it('uses default thresholds when not provided', () => {
      const policyNoThresholds = {
        ...mockPolicyEmpty,
        auto_classify_threshold: undefined,
        prompt_threshold: undefined
      };

      const wrapper = mount(PolicyCard, {
        props: { policy: policyNoThresholds }
      });
      expect(wrapper.text()).toContain('≥85%');
      expect(wrapper.text()).toContain('≥60%');
    });

    it('handles missing library_name gracefully', () => {
      const policyNoLibrary = { ...mockPolicyWithPresets, library_name: null };
      const wrapper = mount(PolicyCard, {
        props: { policy: policyNoLibrary }
      });
      expect(wrapper.text()).toContain('Library');
    });
  });
});
