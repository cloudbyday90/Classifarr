/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, it } from 'vitest'
import { getPgvectorVariantNotice } from '../utils/pgvectorVariantNotice'

const generic = { enabled: true, pgvectorVariant: 'generic' }

describe('pgvector notice presentation', () => {
  it.each([null, undefined, false, 'generic', [], {},
    { pgvectorVariant: 'generic' }, { ...generic, enabled: false }, { ...generic, enabled: 'true' },
    { enabled: true }, { ...generic, pgvectorVariant: 'avx' }, { ...generic, pgvectorVariant: 'avx2' },
    { ...generic, pgvectorVariant: 'unknown' }, { ...generic, pgvectorVariant: {} },
  ])('does not invent a notice for malformed, disabled or non-generic status %j', status => {
    expect(getPgvectorVariantNotice(status)).toBeNull()
  })

  it('explains a reported generic build without suggesting an unsupported restart fix', () => {
    expect(getPgvectorVariantNotice({ ...generic, pgvectorBuild: 'generic' })).toBe(
      'The image reports a generic-only pgvector build. Restarting the same image will not add an optimized binary.',
    )
  })

  it('uses the server string flags only when both AVX capabilities are explicitly absent', () => {
    expect(getPgvectorVariantNotice({ ...generic, pgvectorBuild: 'multi', cpuAvx: 'false', cpuAvx2: 'false' })).toBe(
      'The host reports no AVX or AVX2 support. Generic mode is expected; no restart is needed for this notice.',
    )
  })

  it.each([{}, { cpuAvx: 'true', cpuAvx2: 'true' }, { cpuAvx: 'false', cpuAvx2: 'unknown' },
    { cpuAvx: false, cpuAvx2: false }, { cpuAvx: 'false', cpuAvx2: 'true' },
    { pgvectorBuild: '<img src=x>', cpuAvx: 0, cpuAvx2: 0 },
  ])('does not guess the cause or echo unknown diagnostic data %j', fields => {
    const notice = getPgvectorVariantNotice({ ...generic, ...fields })
    expect(notice).toContain('Review the pgvector selection messages in container startup logs')
    expect(notice).toContain('restarting alone does not guarantee an optimized binary')
    expect(notice).not.toContain('<img')
  })
})
