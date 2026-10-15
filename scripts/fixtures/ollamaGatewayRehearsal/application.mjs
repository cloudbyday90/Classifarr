/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createOllamaApplicationRouting } from '/app/src/services/ollamaApplicationRouting.mjs';
import * as generation from '/app/src/services/ollamaGeneration.mjs';
import * as connection from '/app/src/services/ollamaConnection.mjs';
import * as warming from '/app/src/services/ollamaModelWarming.mjs';
import { createLocalDescriptionBenchmarkClient } from '/app/src/services/localDescriptionBenchmarkClient.mjs';
import { createLocalStudyEmbeddingClient } from '/app/src/services/localStudyEmbeddingClient.mjs';
import { createOllamaVerificationSavedConfigurationClient } from '/app/src/services/ollamaVerificationSavedConfigurationClient.mjs';
import { probeOllamaVerificationCapability } from '/app/src/services/ollamaVerificationCapabilityProbe.mjs';
import { QueueTaskProcessorService } from '/app/src/services/queueTaskProcessorService.mjs';

export async function rehearseApplicationRouting({ gateway, backgroundToken, model }) {
  const configuration = { baseUrl: gateway.upstream, host: '127.0.0.1', port: Number(new URL(gateway.upstream).port), model, embeddingModel: model };
  const options = revision => ({ revision, configuration, foreground: gateway, background: { ...gateway, token: backgroundToken } });
  const owner = createOllamaApplicationRouting(options(1)), getConfig = async () => configuration;
  const settings = { primary_provider: 'ollama', rag_enabled: true, ollama_host: configuration.host, ollama_port: configuration.port, ollama_model: model, embedding_model: model };
  const forbidden = () => { throw new Error('direct_transport_forbidden'); };
  const benchmark = createLocalDescriptionBenchmarkClient(settings, { fetchRequest: forbidden });
  const embedding = createLocalStudyEmbeddingClient(settings, { fetchRequest: forbidden });
  const saved = createOllamaVerificationSavedConfigurationClient({ configuration: settings });
  let listener;
  try {
    const workflow = async () => {
      assert.equal(await generation.generate(getConfig, 'Synthetic only', model), 'synthetic');
      assert.equal(await generation.generateWithProgress(getConfig, forbidden, 'Synthetic only', model, 0, null, null, { requireDoneSignal: true }), 'partialsynthetic');
      assert.equal((await generation.embed(getConfig, forbidden, forbidden, 'Synthetic only', model, '15m')).dims, 2);
      assert.equal((await warming.warmModel(getConfig, model)).keep_alive, '5m');
      assert.equal((await warming.warmEmbeddingModel(getConfig, model)).keep_alive, '5m');
      assert.equal((await connection.getModels(getConfig)).length, 1);
      assert.equal((await connection.getLoadedModels(getConfig)).length, 1);
      assert.equal((await probeOllamaVerificationCapability({ identity: { applicable: true, model, configurationRevision: 1, fingerprint: 'fixture' }, ollamaClient: saved })).statusId, 'verification_ready');
      const identity = await benchmark.inspect();
      let attempts = 0;
      await benchmark.generate({ prompt: 'Synthetic only', count: 2, context: 8192, identity, onGenerationCall: () => { attempts++; } });
      assert.equal(attempts, 1);
      assert.equal((await embedding.inspect()).dimensions, 2);
      assert.deepEqual(await embedding.embedBatch(['Synthetic only'], { dimensions: 2 }), [[0, 1]]);
      await assert.rejects(generation.pullModel(getConfig, model), /gateway_operation_unsupported/);
      listener = createServer((_req, res) => { setTimeout(() => {
        void connection.getVersion(getConfig).then(value => res.end(value), error => res.end(error.code));
      }, 1); });
      await new Promise(resolve => { listener.listen(0, '127.0.0.1', resolve); });
    };
    await owner.run(() => QueueTaskProcessorService.prototype.processTask.call({
      logger: { info() {},error() {} },failTask() { throw new Error('packaged_queue_source_failed'); },
      processClassificationTask: workflow,
    },{ id: 7001,task_type: 'classification',attempts: 2,claim_token: 'PRIVATE',payload: { taskId: 999 } }));
    const url = `http://127.0.0.1:${listener.address().port}`;
    assert.equal(await (await fetch(url)).text(), 'synthetic');
    owner.replace(options(2));
    await assert.rejects(embedding.inspect(), /gateway_client_closed/);
    assert.equal(await (await fetch(url)).text(), 'synthetic');
    owner.close();
    assert.equal(await (await fetch(url)).text(), 'gateway_client_closed');
    assert.throws(() => saved.getVersion(), /gateway_client_closed/);
  } finally {
    owner.close(); benchmark.close(); embedding.close(); saved.close();
    if (listener) { listener.closeAllConnections(); await new Promise(resolve => { listener.close(resolve); }); }
  }
}
