if (process.env.JEST_WORKER_ID) {
	const unsupportedAsync = async () => {
		throw new Error('embeddingProvider.js Jest shim should be mocked or replaced with the native .mjs entrypoint in direct tests.');
	};

	module.exports = {
		getConfig: unsupportedAsync,
		resetConfig: () => {},
		resetMetrics: () => {},
		getCircuitStatus: () => ({}),
		getCircuitStateHistory: () => [],
		resetCircuit: () => {},
		getSameModeProvider: () => ({ provider: null, model: null }),
		getSameModeEmbedding: unsupportedAsync,
		normalizeTestConfig: (savedConfig = {}) => savedConfig,
		isModelCold: () => true,
		getAdaptiveTimeout: config => config?.request_timeout || 30000,
		warmup: unsupportedAsync,
		getMetrics: () => ({}),
		recordError: () => {},
		recordRetry: () => {},
		getEmbedding: unsupportedAsync,
		getOllamaEmbedding: unsupportedAsync,
		getCloudEmbedding: unsupportedAsync,
		getOpenAIEmbedding: unsupportedAsync,
		getGeminiEmbedding: unsupportedAsync,
		getVoyageEmbedding: unsupportedAsync,
		getOpenRouterEmbedding: unsupportedAsync,
		getCohereEmbedding: unsupportedAsync,
		testConnection: unsupportedAsync,
		getProviderDefaults: () => ({}),
		getRecommendedModels: () => ({}),
		getEmbeddingModels: async () => []
	};
} else {
	module.exports = require('./embeddingProvider.shared');
}
