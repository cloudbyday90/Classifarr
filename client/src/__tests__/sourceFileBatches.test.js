/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// @vitest-environment node
import { expect, test, vi } from 'vitest'
import { readSourceFileBatches, SOURCE_READ_BATCH_SIZE } from '../../scripts/lib/sourceFileBatches.mjs'

test('reads every file in order with at most sixteen concurrent reads', async () => {
  const paths = Array.from({ length: 35 }, (_, index) => `file-${index}`)
  let active = 0
  let peak = 0
  const readSource = vi.fn(async (filePath, encoding) => {
    expect(encoding).toBe('utf8')
    peak = Math.max(peak, ++active)
    await Promise.resolve()
    active -= 1
    return `source:${filePath}`
  })
  const batches = []
  for await (const batch of readSourceFileBatches(paths, { readSource })) batches.push(batch)
  expect(SOURCE_READ_BATCH_SIZE).toBe(16)
  expect(peak).toBe(16)
  expect(active).toBe(0)
  expect(batches.map(batch => batch.length)).toEqual([16, 16, 3])
  expect(batches.flat()).toEqual(paths.map(filePath => ({ filePath, source: `source:${filePath}` })))
  expect(readSource).toHaveBeenCalledTimes(paths.length)
})

test('does not prefetch another batch when the consumer stops', async () => {
  const readSource = vi.fn(async () => '')
  const iterator = readSourceFileBatches(Array(33).fill('file'), { readSource })
  expect(readSource).not.toHaveBeenCalled()
  await iterator.next()
  await iterator.return()
  expect(readSource).toHaveBeenCalledTimes(16)
})

test('settles admitted reads and preserves a failure without starting the next batch', async () => {
  const failure = new Error('read failed')
  let completePendingRead
  const readSource = vi.fn(async (_path, _encoding) => {
    const call = readSource.mock.calls.length
    if (call === 1) throw failure
    if (call === 2) return new Promise(resolve => { completePendingRead = resolve })
    return ''
  })
  const iterator = readSourceFileBatches(Array(17).fill('file'), { readSource })
  let settled = false
  const pending = iterator.next().finally(() => { settled = true })
  const rejected = expect(pending).rejects.toBe(failure)
  await Promise.resolve()
  expect(settled).toBe(false)
  completePendingRead('source')
  await rejected
  expect(readSource).toHaveBeenCalledTimes(16)
  expect(await iterator.next()).toEqual({ done: true, value: undefined })
})

test('empty input performs no reads', async () => {
  const readSource = vi.fn()
  expect(await readSourceFileBatches([], { readSource }).next()).toEqual({ done: true, value: undefined })
  expect(readSource).not.toHaveBeenCalled()
})

test('the default reader returns real UTF-8 source text', async () => {
  const filePath = new URL(import.meta.url)
  const iterator = readSourceFileBatches([filePath])
  const { value } = await iterator.next()
  expect(value).toEqual([{ filePath, source: expect.stringContaining('Classifarr Contributors') }])
  expect(await iterator.next()).toEqual({ done: true, value: undefined })
})
