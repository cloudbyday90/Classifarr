if (process.env.JEST_WORKER_ID) {
	const unsupportedAsync = async () => {
		throw new Error('embeddingRouter.js Jest shim should be mocked or replaced with the native .mjs entrypoint in direct tests.');
	};

	module.exports = {
		resetConfig: () => {},
		getConfig: unsupportedAsync,
		isEnabled: unsupportedAsync,
		isCircuitOpen: () => false,
		recordFailure: () => {},
		resetCircuit: () => {},
		isConfigurationError: () => false,
		isOpenCircuitError: () => false,
		shouldRecordFailure: () => false,
		getOpenCircuitFallback: unsupportedAsync,
		testConnection: unsupportedAsync,
		canUseOllamaFallback: () => false,
		embed: unsupportedAsync,
		embedWithOllama: unsupportedAsync,
		getCircuitStatus: () => ({}),
		getCircuitStateHistory: () => []
	};
} else {
	module.exports = require('./embeddingRouter.shared');
}
