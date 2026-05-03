if (process.env.JEST_WORKER_ID) {
	const unsupportedAsync = () => {
		throw new Error('ragRetriever.js Jest shim should be mocked or replaced with the native .mjs entrypoint in direct tests.');
	};

	module.exports = {
		buildRetrievalText: () => '',
		semanticSearch: unsupportedAsync,
		semanticSearchCandidates: () => { throw new Error('ragRetriever.js Jest shim: semanticSearchCandidates'); },
		getEmbeddingCount: unsupportedAsync,
		_getHasMinimumCached: unsupportedAsync,
		calculateRRF: () => [],
		calculateWeightedRRF: () => [],
		legacyHybridCombine: () => [],
		hybridSearch: () => { throw new Error('ragRetriever.js Jest shim: hybridSearch'); },
		graphSearch: unsupportedAsync,
		fullTextSearch: unsupportedAsync,
		calculateDynamicWeight: () => 0,
		getSuggestedLibrary: () => null,
		formatForAIContext: () => '',
		findSimilarItems: unsupportedAsync,
		_embeddingCountCache: null,
		_embeddingCountCachedAt: 0,
		_hasMinimumCache: null,
		_hasMinimumCachedAt: 0,
	};
} else {
	module.exports = require('./ragRetriever.shared');
}
