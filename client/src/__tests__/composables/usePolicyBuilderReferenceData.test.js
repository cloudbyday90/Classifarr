/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it, vi } from 'vitest'
import {
  PRESET_MIGRATION_NOTICE_DISMISS_KEY,
  parsePresetMigrationReport,
  usePolicyBuilderReferenceData,
} from '@/composables/usePolicyBuilderReferenceData'

function createStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues))
  return {
    getItem: vi.fn(key => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
  }
}

function createApiClient(overrides = {}) {
  return {
    getLibraries: vi.fn().mockResolvedValue([{ id: 1, name: 'Movies' }]),
    getGeneralSettings: vi.fn().mockResolvedValue({}),
    getPresetSuggestions: vi.fn().mockResolvedValue({ suggestions: [] }),
    ...overrides,
  }
}

function createPresetsClient(overrides = {}) {
  return {
    getAttachablePresets: vi.fn().mockResolvedValue([
      {
        id: 1,
        name: 'Family',
        description: 'Family movies',
        category: 'audience',
        source: 'builtin',
        usage_count: 2,
        signals: {
          genres: {
            require_any: ['Family'],
            prefer: ['Animation'],
          },
          certifications: {
            include: ['G', 'PG'],
          },
        },
      },
      {
        id: 2,
        name: 'Custom Comedy',
        description: 'Comedy hints',
        category: 'custom',
        source: 'custom',
        usage_count: 0,
        signals: {
          genres: {
            prefer: ['Comedy'],
          },
          certifications: {
            include: ['PG-13'],
          },
        },
      },
    ]),
    ...overrides,
  }
}

describe('usePolicyBuilderReferenceData composable', () => {
  it('parses preset migration reports unless dismissed', () => {
    const storage = createStorage()
    const report = parsePresetMigrationReport({
      dropped_count: 2,
      affected_policy_count: 1,
      executed_at: '2026-06-26T00:00:00Z',
      dropped_attachments: [
        { preset_name: 'Old Regional' },
        { preset_key: 'legacy_language' },
        { preset_name: 'Third' },
        { preset_name: 'Fourth' },
      ],
    }, storage)

    expect(report).toEqual({
      version: '2026-06-26T00:00:00Z',
      summary: '2 incompatible preset attachments were removed automatically across 1 policy. Reapply corrected presets where needed.',
      preview: 'Recently removed: Old Regional, legacy_language, Third, ...',
    })

    const dismissedStorage = createStorage({
      [PRESET_MIGRATION_NOTICE_DISMISS_KEY]: '2026-06-26T00:00:00Z',
    })

    expect(parsePresetMigrationReport({
      dropped_count: 2,
      executed_at: '2026-06-26T00:00:00Z',
    }, dismissedStorage)).toBeNull()
    expect(parsePresetMigrationReport('{bad json}', storage)).toBeNull()
  })

  it('loads libraries, attachable presets, and migration notice through injected clients', async () => {
    const apiClient = createApiClient({
      getGeneralSettings: vi.fn().mockResolvedValue({
        preset_semantics_v2_auto_drop_report: JSON.stringify({
          dropped_count: 1,
          affected_policy_count: 1,
          migration: 'semantic-v2',
        }),
      }),
    })
    const presetsClient = createPresetsClient()
    const referenceData = usePolicyBuilderReferenceData({
      apiClient,
      presetsClient,
      storage: createStorage(),
    })

    await referenceData.loadInitialData()

    expect(apiClient.getLibraries).toHaveBeenCalledOnce()
    expect(presetsClient.getAttachablePresets).toHaveBeenCalledOnce()
    expect(referenceData.libraries.value).toEqual([{ id: 1, name: 'Movies' }])
    expect(referenceData.allPresets.value).toHaveLength(2)
    expect(referenceData.presetMigrationNotice.value.summary).toContain('1 incompatible preset attachment was removed')
  })

  it('builds tabs, filters presets, and derives available intent options', async () => {
    const referenceData = usePolicyBuilderReferenceData({
      apiClient: createApiClient(),
      presetsClient: createPresetsClient(),
      storage: createStorage(),
    })

    await referenceData.loadPresets()

    expect(referenceData.categoryTabs.value).toEqual([
      { value: 'all', label: 'All', count: 2 },
      { value: 'custom', label: 'My Presets', count: 1 },
      { value: 'audience', label: 'Audience', count: 1 },
    ])
    expect(referenceData.availableGenres.value).toEqual(['Animation', 'Comedy', 'Family'])
    expect(referenceData.availableRatings.value).toEqual(['G', 'PG', 'PG-13'])
    expect(referenceData.getPresetUsageCount({ preset_id: 1 })).toBe(2)
    expect(referenceData.formatUsageLabel(1)).toBe('Used in 1 policy')

    referenceData.selectedCategory.value = 'custom'
    expect(referenceData.getFilteredAvailablePresets([]).map(preset => preset.name)).toEqual(['Custom Comedy'])

    referenceData.selectedCategory.value = 'all'
    referenceData.searchQuery.value = 'family'
    expect(referenceData.getFilteredAvailablePresets([]).map(preset => preset.name)).toEqual(['Family'])
    expect(referenceData.getFilteredAvailablePresets([{ id: 1 }]).map(preset => preset.name)).toEqual([])
  })

  it('loads and clears suggestions without leaking errors to callers', async () => {
    const apiClient = createApiClient({
      getPresetSuggestions: vi.fn()
        .mockResolvedValueOnce({ suggestions: [{ id: 10, name: 'Suggested' }] })
        .mockRejectedValueOnce(new Error('network down')),
    })
    const referenceData = usePolicyBuilderReferenceData({
      apiClient,
      presetsClient: createPresetsClient(),
      storage: createStorage(),
    })

    await referenceData.loadSuggestions(14)
    expect(referenceData.suggestedPresets.value).toEqual([{ id: 10, name: 'Suggested' }])

    await referenceData.loadSuggestions(14)
    expect(referenceData.suggestedPresets.value).toEqual([])

    await referenceData.loadSuggestions(null)
    expect(referenceData.suggestedPresets.value).toEqual([])
  })

  it('persists migration notice dismissal through the injected storage boundary', async () => {
    const storage = createStorage()
    const referenceData = usePolicyBuilderReferenceData({
      apiClient: createApiClient(),
      presetsClient: createPresetsClient(),
      storage,
    })

    referenceData.presetMigrationNotice.value = {
      version: 'semantic-v2',
      summary: 'notice',
      preview: '',
    }

    referenceData.dismissPresetMigrationNotice()

    expect(storage.setItem).toHaveBeenCalledWith(PRESET_MIGRATION_NOTICE_DISMISS_KEY, 'semantic-v2')
    expect(referenceData.presetMigrationNotice.value).toBeNull()
  })
})

