/*
 * Classifarr - Copyright (C) 2024-2026 Classifarr Contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { aiRouterService } from './aiRouter.mjs';
import { cloudLLMService } from './cloudLLM.mjs';
import { ollamaService } from './ollama.mjs';
import { buildClassificationDependencyKey } from './classificationProviderDeferralPolicy.mjs';

const COMPLETE_FINISH_REASONS = new Set(['stop', 'STOP', 'completed', 'end_turn']);

export class ClassificationRecoveryReadiness {
  constructor({ cloud = cloudLLMService, ollama = ollamaService, now = Date.now,
    router = aiRouterService,
  } = {}) {
    this.cloud = cloud;
    this.ollama = ollama;
    this.router = router;
    this.now = now;
  }

  async probe(snapshot) {
    const provider = await this.router.getProvider('classification', { configuration: snapshot.config });
    if (!provider || provider.authority?.effectiveMode === 'disabled') return null;
    let ready = false;
    if (provider.type === 'ollama') {
      const result = await this.ollama.preflightConnection({
        host: snapshot.local?.host || provider.config.host,
        port: snapshot.local?.port || provider.config.port,
        model: provider.config.model,
        probeGeneration: true, force: true, includeModels: false,
        connectivityTimeoutMs: 5000, probeTimeoutMs: 30000,
      });
      ready = result.success === true && result.checks?.generation_probe?.ok === true &&
        result.checks.generation_probe.skipped === false;
    } else if (provider.isCloud) {
      const result = await this.cloud.chat(
        [{ role: 'user', content: 'Reply with OK only.' }],
        { ...provider.config, max_tokens: 256, temperature: 0 },
        { requestType: 'classification_recovery_probe' },
      );
      ready = typeof result?.content === 'string' && Boolean(result.content.trim()) &&
        COMPLETE_FINISH_REASONS.has(result.finishReason);
    }
    const dependencyKey = buildClassificationDependencyKey(snapshot, provider);
    return ready ? { fingerprint: snapshot.fingerprint, checkedAt: this.now(),
      ...(dependencyKey ? { dependencyKey } : {}) } : null;
  }
}
