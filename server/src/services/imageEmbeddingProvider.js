if (process.env.JEST_WORKER_ID) {
	const unsupportedAsync = async () => {
		throw new Error('imageEmbeddingProvider.js Jest shim should be mocked or replaced with the native .mjs entrypoint in direct tests.');
	};

	module.exports = {
		normalizeMode: mode => mode,
		resetConfig: () => {},
		getConfig: unsupportedAsync,
		isConfigured: () => false,
		getEffectiveModel: () => null,
		embedImageFromUrl: unsupportedAsync,
		embedCloud: unsupportedAsync,
		embedLocal: unsupportedAsync,
		getLocalModels: async () => [],
		embedVertex: unsupportedAsync,
		embedVoyage: unsupportedAsync,
		embedCohere: unsupportedAsync,
		fetchImageBase64: unsupportedAsync
	};
} else {
	module.exports = require('./imageEmbeddingProvider.shared');
}
