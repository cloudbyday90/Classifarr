import axios from 'axios';
import { appendQueryParam, normalizeBaseUrl } from './url.mjs';
import { parseProviderIds } from './providerIds.mjs';
import sharedFactory from './createEmbyLikeService.shared.js';

const createEmbyLikeServiceModule = sharedFactory.buildCreateEmbyLikeServiceModule({
	axiosClient: axios,
	normalizeBaseUrl,
	appendQueryParam,
	parseProviderIds,
});

export const { createEmbyLikeService } = createEmbyLikeServiceModule;

export default createEmbyLikeServiceModule;
