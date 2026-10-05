/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, it, vi } from 'vitest'
const get = vi.hoisted(() => vi.fn())
vi.mock('@/api/core', () => ({ getDataRequest: get }))
import { getMigrationDiagnostics } from '@/api/migrationDiagnosticsApi'
it('fetches the fixed administrator report through the shared transport', async () => {
  get.mockResolvedValue({ status: 'none' })
  expect(await getMigrationDiagnostics()).toEqual({ status: 'none' })
  expect(get).toHaveBeenCalledExactlyOnceWith('/libraries/migration-diagnostics')
})
