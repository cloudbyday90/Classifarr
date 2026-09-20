/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
jest.unstable_mockModule('../../services/aiRouter.mjs', () => ({ aiRouterService: {} }));
jest.unstable_mockModule('../../services/cloudLLM.mjs', () => ({ cloudLLMService: {} }));
jest.unstable_mockModule('../../services/ollama.mjs', () => ({ ollamaService: {} }));
const { ClassificationRecoveryReadiness } = await import('../../services/classificationRecoveryReadiness.mjs');
const snapshot = { config: { primary_provider: 'custom' }, fingerprint: 'test-fingerprint' };
function harness(provider) {
  const cloud = { chat: jest.fn() };
  const ollama = { preflightConnection: jest.fn() };
  const getProvider = jest.fn().mockResolvedValue(provider);
  return { cloud, ollama, getProvider, service: new ClassificationRecoveryReadiness({
    cloud, ollama, now: () => 12345, router: { getProvider },
  }) };
}
test.each([null, { authority: { effectiveMode: 'disabled' } }, { type: 'unknown' }])('no readiness from configuration alone %#', async (provider) => {
  const { service, cloud, ollama } = harness(provider);
  expect(await service.probe(snapshot)).toBeNull();
  expect(cloud.chat).not.toHaveBeenCalled();
  expect(ollama.preflightConnection).not.toHaveBeenCalled();
});
test.each(['stop', 'STOP', 'completed', 'end_turn'])('accepts completed cloud inference %s using bounded output/accounting', async (finishReason) => {
  const { service, cloud, getProvider } = harness({ type: 'custom', isCloud: true, config: { model: 'model', api_key: 'private' } });
  cloud.chat.mockResolvedValue({ content: 'OK', finishReason });
  expect(await service.probe(snapshot)).toEqual({ fingerprint: snapshot.fingerprint, checkedAt: 12345 });
  expect(getProvider).toHaveBeenCalledWith('classification', { configuration: snapshot.config });
  expect(cloud.chat).toHaveBeenCalledWith([{ role: 'user', content: 'Reply with OK only.' }],
    expect.objectContaining({ max_tokens: 256, temperature: 0 }), { requestType: 'classification_recovery_probe' });
});
test.each([undefined, {}, { content: ' ' }, { content: 1 }, { content: 'OK', finishReason: 'length' },
  { content: 'OK', finishReason: 'error' }])('rejects incomplete cloud result %#', async (result) => {
  const { service, cloud } = harness({ isCloud: true, config: {} });
  cloud.chat.mockResolvedValue(result);
  expect(await service.probe(snapshot)).toBeNull();
});
test.each([undefined, { host: 'legacy', port: 1234 }])('pins local generation to the effective endpoint %#', async (local) => {
  const { service, ollama } = harness({ type: 'ollama', config: { host: 'local', port: 11434, model: 'tested' } });
  ollama.preflightConnection.mockResolvedValue({ success: true, checks: { generation_probe: { ok: true, skipped: false } } });
  expect(await service.probe({ ...snapshot, local })).not.toBeNull();
  expect(ollama.preflightConnection).toHaveBeenCalledWith(expect.objectContaining({
    host: local?.host || 'local', port: local?.port || 11434, model: 'tested',
    probeGeneration: true, force: true, probeTimeoutMs: 30000,
  }));
});
test.each([{ success: true }, { success: false }, { success: true, checks: { generation_probe: { ok: true, skipped: true } } },
  { success: true, checks: { generation_probe: { ok: false } } }])('connectivity is not local readiness %#', async (result) => {
  const { service, ollama } = harness({ type: 'ollama', config: {} });
  ollama.preflightConnection.mockResolvedValue(result);
  expect(await service.probe(snapshot)).toBeNull();
});
test('propagates provider errors to the orchestration boundary without returning proof', async () => {
  const { service, cloud } = harness({ isCloud: true, config: {} });
  cloud.chat.mockRejectedValue(new Error('unavailable'));
  await expect(service.probe(snapshot)).rejects.toThrow('unavailable');
});

test('binds completed generation to a provider dependency even at configuration revision zero', async () => {
  const { service, cloud } = harness({ type: 'custom', isCloud: true, config: { model: 'model' } });
  cloud.chat.mockResolvedValue({ content: 'OK', finishReason: 'stop' });
  expect(await service.probe({ ...snapshot, config: { ...snapshot.config, configuration_revision: 0 } }))
    .toMatchObject({ dependencyKey: expect.stringMatching(/^[a-f0-9]{64}$/) });
});
