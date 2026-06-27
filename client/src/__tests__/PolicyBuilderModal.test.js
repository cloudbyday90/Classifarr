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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import PolicyBuilderModal from '../components/policies/PolicyBuilderModal.vue';
import api from '../api';
import { getDataRequest } from '../api/core';

vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
    getData: vi.fn(),
    getLibraries: vi.fn(),
    getGeneralSettings: vi.fn(),
    getPresetSuggestions: vi.fn(),
  }
}));

vi.mock('../api/core', () => ({
  getDataRequest: vi.fn(),
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
  getSettingsRequest: vi.fn(),
  updateSettingsRequest: vi.fn()
}));

describe('PolicyBuilderModal.vue', () => {
  const mockLibraries = [
    { id: 1, name: 'Sci-Fi Movies', media_type: 'movie' }
  ];

  const mockPresets = [
    {
      id: 1,
      name: 'Sci-Fi',
      icon: '🚀',
      category: 'genres',
      description: 'Science fiction content',
      usage_count: 4,
      source: 'builtin',
      signals: {}
    },
    {
      id: 2,
      name: 'Family',
      icon: '👨‍👩‍👧‍👦',
      category: 'audience',
      description: 'Family friendly content',
      usage_count: 1,
      source: 'builtin',
      signals: {}
    },
    {
      id: 9,
      key: 'custom_family_mix',
      name: 'Family Remix',
      icon: '⚙️',
      category: 'custom',
      description: 'My custom family preset',
      usage_count: 2,
      source: 'custom',
      signals: {}
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    api.getLibraries.mockImplementation((...args) => api.get('/libraries', ...args).then((response) => response.data));
    api.getGeneralSettings.mockImplementation((...args) => api.get('/settings', ...args).then((response) => response.data));
    api.getPresetSuggestions.mockImplementation((libraryId) => api.get(`/policies/presets/suggest/${libraryId}`).then((response) => response.data));
    getDataRequest.mockImplementation((url, config) => api.get(url, config).then((response) => response.data));
    window.localStorage.clear();
    document.body.innerHTML = '';
  });

  it('shows usage count labels in available preset cards', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') return Promise.resolve({ data: mockPresets });
      if (url === '/settings') return Promise.resolve({ data: {} });
      return Promise.resolve({ data: { suggestions: [] } });
    });

    mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        policy: {
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          presets: []
        },
        libraryId: 1
      },
      attachTo: document.body
    });

    await flushPromises();

    expect(document.body.textContent).toContain('Used in 4 policies');
    expect(document.body.textContent).toContain('Used in 1 policy');
  });

  it('shows My Presets when attachable custom presets exist', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') return Promise.resolve({ data: mockPresets });
      if (url === '/settings') return Promise.resolve({ data: {} });
      return Promise.resolve({ data: { suggestions: [] } });
    });

    mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          presets: []
        }
      },
      attachTo: document.body
    });

    await flushPromises();

    expect(document.body.textContent).toContain('My Presets');
    expect(document.body.textContent).toContain('Family Remix');
  });

  it('includes profile weight in the advanced total and save payload', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') return Promise.resolve({ data: mockPresets });
      if (url === '/settings') return Promise.resolve({ data: {} });
      return Promise.resolve({ data: { suggestions: [] } });
    });

    const wrapper = mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          profile_weight: 0.25,
          preset_weight: 0.35,
          pattern_weight: 0.15,
          rag_weight: 0.15,
          history_weight: 0.10,
          presets: [
            { id: 1, name: 'Sci-Fi', icon: '🚀', weight: 1.0 }
          ]
        }
      },
      attachTo: document.body
    });

    await flushPromises();

    const advancedButton = Array.from(document.body.querySelectorAll('button'))
      .find(button => button.textContent.includes('Advanced Settings'));
    expect(advancedButton).toBeTruthy();
    advancedButton.click();
    await flushPromises();

    expect(document.body.textContent).toContain('Profile: 25%');
    expect(document.body.textContent).toContain('Total: 100%');

    await wrapper.vm.save();

    const emittedSave = wrapper.emitted('save');
    expect(emittedSave).toBeTruthy();
    expect(emittedSave[0][0]).toMatchObject({
      profile_weight: 0.25,
      preset_weight: 0.35,
      pattern_weight: 0.15,
      rag_weight: 0.15,
      history_weight: 0.10
    });
  });

  it('uses preset usage map for suggested cards without usage_count payload', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') return Promise.resolve({ data: mockPresets });
      if (url === '/settings') return Promise.resolve({ data: {} });
      if (url === '/policies/presets/suggest/1') {
        return Promise.resolve({
          data: {
            suggestions: [
              {
                id: 1,
                name: 'Sci-Fi',
                icon: '🚀',
                suggestion_score: 95,
                match_score: 95
              }
            ]
          }
        });
      }
      return Promise.resolve({ data: [] });
    });

    mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          presets: [
            { id: 1, name: 'Sci-Fi', icon: '🚀', weight: 1.0 }
          ]
        }
      },
      attachTo: document.body
    });

    await flushPromises();

    const templateMechanicsButton = Array.from(document.body.querySelectorAll('button'))
      .find(button => button.textContent.includes('Starter Templates & Signal Details'));
    expect(templateMechanicsButton).toBeTruthy();
    templateMechanicsButton.click();
    await flushPromises();

    expect(document.body.textContent).toContain('Used in 4 policies');
    expect(api.getPresetSuggestions).toHaveBeenCalledWith(1);
  });

  it('marks suggested custom presets as My Preset', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') return Promise.resolve({ data: mockPresets });
      if (url === '/settings') return Promise.resolve({ data: {} });
      if (url === '/policies/presets/suggest/1') {
        return Promise.resolve({
          data: {
            suggestions: [
              {
                id: 9,
                name: 'Family Remix',
                icon: '⚙️',
                source: 'custom',
                suggestion_score: 88,
                match_score: 88
              }
            ]
          }
        });
      }
      return Promise.resolve({ data: [] });
    });

    mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          presets: []
        }
      },
      attachTo: document.body
    });

    await flushPromises();

    expect(document.body.textContent).toContain('My Preset');
    expect(document.body.textContent).toContain('Family Remix');
  });

  it('lets users mark language presets as strict and emits strict customSignals on save', async () => {
    const languagePreset = {
      id: 3,
      name: 'Scandinavian',
      icon: '🇸🇪',
      category: 'regional',
      description: 'Nordic language content',
      usage_count: 2,
      source: 'builtin',
      suggestion_warnings: ['runtime_semantics_review_recommended'],
      signals: {
        language: {
          require_any: ['sv', 'no', 'da', 'fi']
        }
      }
    };

    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') return Promise.resolve({ data: [languagePreset] });
      if (url === '/settings') return Promise.resolve({ data: {} });
      if (url === '/policies/presets/suggest/1') {
        return Promise.resolve({
          data: {
            suggestions: [
              {
                ...languagePreset,
                suggestion_score: 78
              }
            ]
          }
        });
      }
      return Promise.resolve({ data: [] });
    });

    const wrapper = mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          presets: []
        }
      },
      attachTo: document.body
    });

    await flushPromises();

    expect(document.body.textContent).toContain('Review runtime behavior');

    wrapper.vm.togglePresetSelection(languagePreset);
    await flushPromises();
    wrapper.vm.togglePresetCustomize(3);
    await flushPromises();
    wrapper.vm.setPresetSignalStrict({
      preset: wrapper.vm.selectedPresets[0],
      signalType: 'language',
      strict: true
    });
    await flushPromises();
    await wrapper.vm.save();

    const emittedSave = wrapper.emitted('save');
    expect(emittedSave).toBeTruthy();
    expect(emittedSave[0][0].presets[0]).toMatchObject({
      preset_id: 3,
      customSignals: {
        language: {
          strict: true
        }
      }
    });
  });

  it('shows the intent-first editor and saves intent edits as structured custom signals', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') {
        return Promise.resolve({
          data: [{
            id: 1,
            name: 'Starter',
            icon: '📦',
            category: 'audience',
            description: 'Starter preset',
            usage_count: 0,
            source: 'builtin',
            signals: {
              genres: { prefer: ['Comedy'] },
              certifications: { include: ['PG', 'PG-13', 'R'] }
            }
          }]
        });
      }
      if (url === '/settings') return Promise.resolve({ data: {} });
      return Promise.resolve({ data: { suggestions: [] } });
    });

    const wrapper = mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          presets: [
            { id: 1, name: 'Starter', icon: '📦', weight: 1.0 }
          ]
        }
      },
      attachTo: document.body
    });

    await flushPromises();

    expect(document.body.textContent).toContain('Policy Intent Builder');
    expect(document.body.textContent).toContain('The media server shows how this library is used today');
    expect(document.body.textContent).toContain('Belongs Here');
    expect(document.body.textContent).toContain('Hard Limits');

    const templateMechanicsButton = Array.from(document.body.querySelectorAll('button'))
      .find(button => button.textContent.includes('Starter Templates & Signal Details'));
    expect(templateMechanicsButton).toBeTruthy();
    templateMechanicsButton.click();
    await flushPromises();

    expect(document.body.textContent).toContain('Starter Templates (1)');

    wrapper.vm.addIntentSignal({
      presetId: 1,
      signalType: 'genres',
      key: 'require_any',
      value: 'Family',
      extras: { semantics: 'identity' }
    });
    wrapper.vm.setIntentSignalConfig({
      presetId: 1,
      signalType: 'certifications',
      config: {
        mode: 'max',
        max: 'PG-13',
        constraint_mode: 'strict'
      }
    });
    await flushPromises();
    await wrapper.vm.save();

    const emittedSave = wrapper.emitted('save');
    expect(emittedSave).toBeTruthy();
    expect(emittedSave[0][0].presets[0]).toMatchObject({
      preset_id: 1,
      customSignals: {
        genres: {
          require_any: ['Family'],
          semantics: 'identity'
        },
        certifications: {
          mode: 'max',
          max: 'PG-13',
          constraint_mode: 'strict'
        }
      }
    });
  });

  it('orders policy behavior and intent editing before starter-template mechanics', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') return Promise.resolve({ data: mockPresets });
      if (url === '/settings') return Promise.resolve({ data: {} });
      return Promise.resolve({ data: { suggestions: [] } });
    });

    mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          presets: [
            { id: 1, name: 'Sci-Fi', icon: '🚀', weight: 1.0 }
          ]
        }
      },
      attachTo: document.body
    });

    await flushPromises();

    const text = document.body.textContent;
    const summaryIndex = text.indexOf('Policy Behavior Summary');
    const editorIndex = text.indexOf('Policy Intent Builder');
    const templateIndex = text.indexOf('Starter Templates & Signal Details');

    expect(summaryIndex).toBeGreaterThan(-1);
    expect(editorIndex).toBeGreaterThan(summaryIndex);
    expect(templateIndex).toBeGreaterThan(editorIndex);
  });

  it('preserves unchanged legacy custom signals when saving through the draft bridge', async () => {
    const legacyCustomSignals = {
      genres: {
        require_any: ['Family'],
        semantics: 'identity',
        source_note: 'operator-confirmed'
      },
      certifications: {
        mode: 'max',
        max: 'PG-13',
        constraint_mode: 'strict'
      },
      language: {
        strict: true
      },
      removed: {
        genres: {
          prefer: ['Comedy']
        }
      },
      custom_block: {
        arbitrary: ['keep-me']
      }
    };

    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') {
        return Promise.resolve({
          data: [{
            id: 1,
            name: 'Starter',
            icon: '📦',
            category: 'audience',
            description: 'Starter preset',
            usage_count: 0,
            source: 'builtin',
            signals: {}
          }]
        });
      }
      if (url === '/settings') return Promise.resolve({ data: {} });
      return Promise.resolve({ data: { suggestions: [] } });
    });

    const wrapper = mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          description: 'Existing description',
          enabled: true,
          priority: 7,
          auto_classify_threshold: 82,
          prompt_threshold: 61,
          presets: [
            {
              id: 1,
              preset_id: 1,
              name: 'Starter',
              icon: '📦',
              weight: 1.25,
              customSignals: legacyCustomSignals
            }
          ]
        }
      },
      attachTo: document.body
    });

    await flushPromises();
    await wrapper.vm.save();

    const emittedSave = wrapper.emitted('save');
    expect(emittedSave).toBeTruthy();
    expect(emittedSave[0][0].presets).toEqual([
      {
        preset_id: 1,
        weight: 1.25,
        customSignals: legacyCustomSignals
      }
    ]);
  });

  it('preserves unchanged API-shaped preset custom_signals on modal save', async () => {
    const customSignals = {
      keywords: {
        require_any: ['princess'],
        semantics: 'identity'
      },
      language: {
        strict: false,
        runtime_mode: 'advisory'
      }
    };

    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') return Promise.resolve({ data: mockPresets });
      if (url === '/settings') return Promise.resolve({ data: {} });
      return Promise.resolve({ data: { suggestions: [] } });
    });

    const wrapper = mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          presets: [
            {
              preset_id: 2,
              name: 'Family',
              icon: '👨‍👩‍👧‍👦',
              weight: 0.8,
              custom_signals: customSignals
            }
          ]
        }
      },
      attachTo: document.body
    });

    await flushPromises();
    await wrapper.vm.save();

    const emittedSave = wrapper.emitted('save');
    expect(emittedSave).toBeTruthy();
    expect(emittedSave[0][0].presets).toEqual([
      {
        preset_id: 2,
        weight: 0.8,
        customSignals
      }
    ]);
  });

  it('saves removed base signal markers through the draft-backed modal API', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') {
        return Promise.resolve({
          data: [{
            id: 1,
            name: 'Starter',
            icon: '📦',
            category: 'genres',
            description: 'Starter preset',
            usage_count: 0,
            source: 'builtin',
            signals: {
              genres: {
                prefer: ['Comedy']
              }
            }
          }]
        });
      }
      if (url === '/settings') return Promise.resolve({ data: {} });
      return Promise.resolve({ data: { suggestions: [] } });
    });

    const wrapper = mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          presets: [
            {
              id: 1,
              preset_id: 1,
              name: 'Starter',
              icon: '📦',
              weight: 1
            }
          ]
        }
      },
      attachTo: document.body
    });

    await flushPromises();

    wrapper.vm.setSignalRemoval({
      preset: wrapper.vm.selectedPresets[0],
      signalType: 'genres',
      key: 'prefer',
      value: 'Comedy',
      removed: true
    });
    await flushPromises();
    await wrapper.vm.save();

    expect(wrapper.emitted('save')[0][0].presets[0].customSignals).toEqual({
      removed: {
        genres: {
          prefer: ['Comedy']
        }
      }
    });

    wrapper.vm.setSignalRemoval({
      preset: wrapper.vm.selectedPresets[0],
      signalType: 'genres',
      key: 'prefer',
      value: 'Comedy',
      removed: false
    });
    await flushPromises();
    await wrapper.vm.save();

    expect(wrapper.emitted('save')[1][0].presets[0].customSignals).toBeNull();
  });

  it('saves custom signal additions and removals through the draft-backed modal API', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') {
        return Promise.resolve({
          data: [{
            id: 1,
            name: 'Starter',
            icon: '📦',
            category: 'genres',
            description: 'Starter preset',
            usage_count: 0,
            source: 'builtin',
            signals: {}
          }]
        });
      }
      if (url === '/settings') return Promise.resolve({ data: {} });
      return Promise.resolve({ data: { suggestions: [] } });
    });

    const wrapper = mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          presets: [
            {
              id: 1,
              preset_id: 1,
              name: 'Starter',
              icon: '📦',
              weight: 1
            }
          ]
        }
      },
      attachTo: document.body
    });

    await flushPromises();

    wrapper.vm.addCustomSignal({
      preset: wrapper.vm.selectedPresets[0],
      signalType: 'certifications',
      key: 'include',
      value: 'PG'
    });
    wrapper.vm.addCustomSignal({
      preset: wrapper.vm.selectedPresets[0],
      signalType: 'keywords',
      key: 'require_any',
      value: 'space opera'
    });
    await flushPromises();
    await wrapper.vm.save();

    expect(wrapper.emitted('save')[0][0].presets[0].customSignals).toEqual({
      certifications: {
        include: ['PG']
      },
      keywords: {
        require_any: ['space opera']
      }
    });

    wrapper.vm.removeCustomSignal({
      preset: wrapper.vm.selectedPresets[0],
      signalType: 'certifications',
      key: 'include',
      value: 'PG'
    });
    wrapper.vm.removeCustomSignal({
      preset: wrapper.vm.selectedPresets[0],
      signalType: 'keywords',
      key: 'require_any',
      value: 'space opera'
    });
    await flushPromises();
    await wrapper.vm.save();

    expect(wrapper.emitted('save')[1][0].presets[0].customSignals).toBeNull();
  });

  it('renders policy intent entries from the draft state boundary', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') {
        return Promise.resolve({
          data: [{
            id: 1,
            name: 'Starter',
            icon: '📦',
            category: 'audience',
            description: 'Starter preset',
            usage_count: 0,
            source: 'builtin',
            signals: {}
          }]
        });
      }
      if (url === '/settings') return Promise.resolve({ data: {} });
      return Promise.resolve({ data: { suggestions: [] } });
    });

    const wrapper = mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          presets: [
            { id: 1, name: 'Starter', icon: '📦', weight: 1.0 }
          ]
        }
      },
      attachTo: document.body
    });

    await flushPromises();

    wrapper.vm.intentDraft.presets[0].buckets.identity_signals.push({
      bucket: 'identity_signals',
      signal_type: 'genres',
      values: { require_any: ['Family'] },
      metadata: { semantics: 'identity' },
      source: 'intent_draft'
    });
    await flushPromises();

    expect(document.body.textContent).toContain('genres: Family');
  });

  it('shows preset migration notice when auto-drop report exists', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') return Promise.resolve({ data: mockPresets });
      if (url === '/settings') {
        return Promise.resolve({
          data: {
            preset_semantics_v2_auto_drop_report: JSON.stringify({
              dropped_count: 2,
              affected_policy_count: 1,
              executed_at: '2026-03-13T23:30:00Z',
              dropped_attachments: [
                { preset_name: 'Scandinavian' },
                { preset_name: 'Korean' }
              ]
            })
          }
        });
      }
      return Promise.resolve({ data: { suggestions: [] } });
    });

    mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          presets: []
        }
      },
      attachTo: document.body
    });

    await flushPromises();

    expect(document.body.textContent).toContain('Legacy preset attachments were auto-dropped after upgrade');
    expect(document.body.textContent).toContain('2 incompatible preset attachments were removed automatically across 1 policy.');
    expect(document.body.textContent).toContain('Recently removed: Scandinavian, Korean');
  });

  it('lets users dismiss the preset migration notice and keeps it hidden for the same report', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') return Promise.resolve({ data: mockPresets });
      if (url === '/settings') {
        return Promise.resolve({
          data: {
            preset_semantics_v2_auto_drop_report: JSON.stringify({
              dropped_count: 1,
              affected_policy_count: 1,
              executed_at: '2026-03-13T23:45:00Z',
              dropped_attachments: [
                { preset_name: 'Scandinavian' }
              ]
            })
          }
        });
      }
      return Promise.resolve({ data: { suggestions: [] } });
    });

    const wrapper = mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          presets: []
        }
      },
      attachTo: document.body
    });

    await flushPromises();

    expect(document.body.textContent).toContain('Legacy preset attachments were auto-dropped after upgrade');

    expect(typeof wrapper.vm.dismissPresetMigrationNotice).toBe('function');
    wrapper.vm.dismissPresetMigrationNotice();
    await flushPromises();

    expect(document.body.textContent).not.toContain('Legacy preset attachments were auto-dropped after upgrade');
    expect(window.localStorage.getItem('classifarr.presetMigrationNotice.dismissed')).toBe('2026-03-13T23:45:00Z');

    wrapper.unmount();

    mount(PolicyBuilderModal, {
      props: {
        modelValue: true,
        libraryId: 1,
        policy: {
          library_id: 1,
          name: 'Sci-Fi Movies Policy',
          presets: []
        }
      },
      attachTo: document.body
    });

    await flushPromises();

    expect(document.body.textContent).not.toContain('Legacy preset attachments were auto-dropped after upgrade');
  });
});
