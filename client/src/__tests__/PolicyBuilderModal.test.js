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

vi.mock('../api', () => ({
  default: {
    get: vi.fn()
  }
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
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows usage count labels in available preset cards', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') return Promise.resolve({ data: mockPresets });
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

  it('uses preset usage map for suggested cards without usage_count payload', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/libraries') return Promise.resolve({ data: mockLibraries });
      if (url === '/policies/presets/all') return Promise.resolve({ data: mockPresets });
      if (url === '/policies/presets/suggest/1') {
        return Promise.resolve({
          data: {
            suggestions: [
              {
                id: 1,
                name: 'Sci-Fi',
                icon: '🚀',
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

    expect(document.body.textContent).toContain('Used in 4 policies');
    expect(api.get).toHaveBeenCalledWith('/policies/presets/suggest/1');
  });
});
