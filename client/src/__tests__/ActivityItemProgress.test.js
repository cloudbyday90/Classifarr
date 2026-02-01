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

import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ActivityItemProgress from '../components/activity/ActivityItemProgress.vue';

describe('ActivityItemProgress.vue - Issue #192 Phase Details', () => {
  let wrapper;

  const mockTask = {
    title: 'The Matrix',
    mediaType: 'movie',
    currentPhase: 'rag_analysis',
    progress: 57,
    phaseIndex: 4,
    phaseDuration: 1200,
    phases: [
      {
        name: 'queued',
        status: 'complete',
        label: 'Queued',
        duration_ms: 100
      },
      {
        name: 'metadata_fetch',
        status: 'complete',
        label: 'Metadata Fetch',
        duration_ms: 1200,
        metadata: { tmdb_id: 27205 }
      },
      {
        name: 'policy_eval',
        status: 'complete',
        label: 'Policy Evaluation',
        duration_ms: 800,
        metadata: { matched_policy: 'Sci-Fi & Action' }
      },
      {
        name: 'rag_analysis',
        status: 'in_progress',
        label: 'RAG Analysis',
        started_at: new Date().toISOString(),
        metadata: { embedding_count: 4532 }
      },
      {
        name: 'signal_combine',
        status: 'pending',
        label: 'Signal Combination'
      },
      {
        name: 'ai_analysis',
        status: 'pending',
        label: 'AI Analysis'
      },
      {
        name: 'decision',
        status: 'pending',
        label: 'Decision'
      },
      {
        name: 'notification',
        status: 'pending',
        label: 'Notification'
      }
    ]
  };

  beforeEach(() => {
    wrapper = mount(ActivityItemProgress, {
      props: {
        task: mockTask
      }
    });
  });

  it('should render task title and basic info', () => {
    expect(wrapper.text()).toContain('The Matrix');
    expect(wrapper.text()).toContain('(movie)');
    expect(wrapper.text()).toContain('57%');
  });

  it('should show collapse/expand button', () => {
    const button = wrapper.find('button[aria-label*="phase details"]');
    expect(button.exists()).toBe(true);
  });

  it('should not show phase details by default', () => {
    const phaseDetails = wrapper.find('.space-y-1\\.5');
    expect(phaseDetails.exists()).toBe(false);
  });

  it('should expand phase details when button is clicked', async () => {
    const button = wrapper.find('button[aria-label*="Expand phase details"]');
    await button.trigger('click');

    const phaseDetails = wrapper.find('.space-y-1\\.5');
    expect(phaseDetails.exists()).toBe(true);
  });

  it('should display all phases when expanded', async () => {
    const button = wrapper.find('button');
    await button.trigger('click');

    const phaseElements = wrapper.findAll('.space-y-1\\.5 > div');
    expect(phaseElements.length).toBe(8);
  });

  it('should show correct status icons for phases', async () => {
    const button = wrapper.find('button');
    await button.trigger('click');

    const html = wrapper.html();
    
    // Completed phases should have checkmark
    expect(html).toContain('✓');
    
    // In-progress phase should have bullet
    expect(html).toContain('●');
    
    // Pending phases should have empty circle
    expect(html).toContain('○');
  });

  it('should display duration for completed phases', async () => {
    const button = wrapper.find('button');
    await button.trigger('click');

    const html = wrapper.html();
    
    // Should show durations formatted
    expect(html).toContain('0.1s'); // queued (100ms)
    expect(html).toContain('1.2s'); // metadata_fetch (1200ms)
    expect(html).toContain('0.8s'); // policy_eval (800ms)
  });

  it('should show "running..." for in-progress phase', async () => {
    const button = wrapper.find('button');
    await button.trigger('click');

    expect(wrapper.text()).toContain('running...');
  });

  it('should display phase metadata when available', async () => {
    const button = wrapper.find('button');
    await button.trigger('click');

    const html = wrapper.html();
    
    // Should show TMDB ID
    expect(html).toContain('TMDB: 27205');
    
    // Should show matched policy (Vue escapes & as &amp; but keeps quotes as is)
    expect(html).toContain('Matched: "Sci-Fi &amp; Action"');
    
    // Should show embedding count
    expect(html).toContain('Comparing to 4,532 embeddings');
  });

  it('should collapse when button is clicked again', async () => {
    const button = wrapper.find('button');
    
    // Expand
    await button.trigger('click');
    let phaseDetails = wrapper.find('.space-y-1\\.5');
    expect(phaseDetails.exists()).toBe(true);
    
    // Collapse
    await button.trigger('click');
    phaseDetails = wrapper.find('.space-y-1\\.5');
    expect(phaseDetails.exists()).toBe(false);
  });

  it('should rotate chevron icon when expanded', async () => {
    const button = wrapper.find('button');
    const svg = wrapper.find('svg');
    
    // Initially not rotated
    expect(svg.classes()).not.toContain('rotate-90');
    
    // Expanded - should rotate
    await button.trigger('click');
    expect(svg.classes()).toContain('rotate-90');
  });

  it('should handle task without phases array', () => {
    const taskWithoutPhases = {
      title: 'Test Movie',
      mediaType: 'movie',
      currentPhase: 'queued',
      progress: 14,
      phaseIndex: 1,
      phaseDuration: 100
    };

    const wrapperNoPhases = mount(ActivityItemProgress, {
      props: {
        task: taskWithoutPhases
      }
    });

    // Should not crash
    expect(wrapperNoPhases.text()).toContain('Test Movie');
  });

  it('should format phase labels correctly', async () => {
    const button = wrapper.find('button');
    await button.trigger('click');

    const html = wrapper.html();
    
    // Check that full labels are displayed
    expect(html).toContain('Metadata Fetch');
    expect(html).toContain('Policy Evaluation');
    expect(html).toContain('RAG Analysis');
    expect(html).toContain('Signal Combination');
    expect(html).toContain('AI Analysis');
  });
});
