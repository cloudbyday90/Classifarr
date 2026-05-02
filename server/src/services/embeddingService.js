if (process.env.JEST_WORKER_ID) {
	const unsupportedAsync = async () => {
		throw new Error('embeddingService.js Jest shim should be mocked or replaced with the native .mjs entrypoint in direct tests.');
	};

	module.exports = {
		EMBEDDING_FORMAT_VERSION: 2,
		getProviderAvailabilityStatus: () => ({
			status: 'available',
			isOffline: false,
			cooldownUntil: null,
			lastError: null,
			failureCount: 0
		}),
		resetProviderAvailability: () => {},
		createProviderOfflineError: () => Object.assign(new Error('PROVIDER_OFFLINE'), { code: 'EMBEDDING_PROVIDER_OFFLINE' }),
		createProviderBusyError: () => Object.assign(new Error('PROVIDER_BUSY'), { code: 'EMBEDDING_PROVIDER_BUSY' }),
		isProviderBusyError: () => false,
		isProviderConnectionError: () => false,
		markProviderOffline: unsupportedAsync,
		probeProviderRecovery: unsupportedAsync,
		ensureProviderAvailable: unsupportedAsync,
		hashValue: value => value,
		resolvePosterUrl: () => null,
		resolvePosterUrlForClassification: unsupportedAsync,
		getExistingImageEmbeddingMeta: unsupportedAsync,
		shouldReuseImageEmbedding: () => false,
		shouldIncludeImageEmbeddings: unsupportedAsync,
		safeGet: (_obj, _path, defaultValue = null) => defaultValue,
		extractNames: () => [],
		formatForEmbedding: () => '',
		checkEmbeddingVersionMismatch: unsupportedAsync,
		generateAndStore: unsupportedAsync,
		generateImageEmbedding: unsupportedAsync,
		storeImageEmbedding: unsupportedAsync,
		storeEmbedding: unsupportedAsync,
		markStale: unsupportedAsync,
		getStats: unsupportedAsync,
		getImageStats: unsupportedAsync,
		getPendingCount: unsupportedAsync,
		getPendingBreakdown: unsupportedAsync,
		getPendingEmbeddings: unsupportedAsync,
		hasMinimumEmbeddings: unsupportedAsync
	};
} else {
	module.exports = require('./embeddingService.shared');
}
