/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { createLogger } from '../utils/logger.mjs';
import { normalizeMetadataListLower } from '../utils/metadataNormalization.mjs';
import { signalCanEstablishIdentity } from '../utils/policySignals.mjs';
import { policyExclusionService } from './policyExclusionService.mjs';
import {
    parseFiniteNumber,
    hasConfiguredList,
    getCertificationOrder,
    keywordMatchesTerm
} from './policyEngineUtils.mjs';

const logger = createLogger('PolicyEngine');

export function scoreCertification(config, item) {
    try {
        const cert = item.certification?.toUpperCase();
        if (!cert) return 0;

        if (config.mode === 'include') {
            const included = (config.include || []).map(c => c.toUpperCase());
            return included.includes(cert) ? 100 : 0;
        }

        if (config.mode === 'exclude') {
            const excluded = (config.exclude || []).map(c => c.toUpperCase());
            return excluded.includes(cert) ? 0 : 100;
        }

        if (config.mode === 'max') {
            const maxCert = config.max?.toUpperCase();
            const maxOrder = getCertificationOrder(maxCert);
            const itemOrder = getCertificationOrder(cert);
            
            if (!maxOrder || !itemOrder || maxOrder !== itemOrder) return 50;

            const maxIndex = maxOrder.indexOf(maxCert);
            const itemIndex = itemOrder.indexOf(cert);
            return itemIndex <= maxIndex ? 100 : 0;
        }

        return 0;
    } catch (_error) {
        return 0;
    }
}

export function scoreGenres(config, item) {
    try {
        const genres = normalizeMetadataListLower(item.genres);
        if (genres.length === 0) {
            return hasConfiguredList(config.require_all) || hasConfiguredList(config.require_any)
                ? 0
                : 50;
        }

        let score = 50;

        if (config.require_all && config.require_all.length > 0) {
            const allPresent = config.require_all.every(g => 
                genres.includes(g.toLowerCase())
            );
            if (!allPresent) return 0;
            score = 100;
        }

        if (config.require_any && config.require_any.length > 0) {
            const anyPresent = config.require_any.some(g => 
                genres.includes(g.toLowerCase())
            );
            if (!anyPresent) return 0;
            score = Math.max(score, 80);
        }

        if (config.prefer && config.prefer.length > 0) {
            const matchCount = config.prefer.filter(g => 
                genres.includes(g.toLowerCase())
            ).length;
            const matchPercent = matchCount / config.prefer.length;
            score = Math.max(score, 50 + (matchPercent * 30));
        }

        if (config.exclude && config.exclude.length > 0) {
            const hasExcluded = config.exclude.some(g => 
                genres.includes(g.toLowerCase())
            );
            if (hasExcluded) return 0;
        }

        return score;
    } catch (_error) {
        return 0;
    }
}

export function scoreKeywords(config, item) {
    try {
        const keywords = normalizeMetadataListLower(item.keywords);
        const overview = (item.overview || '').toLowerCase();
        const title = (item.title || '').toLowerCase();
        
        const searchableText = [overview, title].filter(Boolean).join(' ');

        let score = 50;

        if (config.require_any && config.require_any.length > 0) {
            const anyPresent = config.require_any.some(k => 
                keywordMatchesTerm(k, keywords, searchableText)
            );
            if (!anyPresent) return 0;
            score = 80;
        }

        if (config.prefer && config.prefer.length > 0) {
            const matchCount = config.prefer.filter(k => 
                keywordMatchesTerm(k, keywords, searchableText)
            ).length;
            const matchPercent = matchCount / config.prefer.length;
            score = Math.max(score, 50 + (matchPercent * 30));
        }

        if (config.exclude && config.exclude.length > 0) {
            const hasExcluded = config.exclude.some(k => 
                keywordMatchesTerm(k, keywords, searchableText)
            );
            if (hasExcluded) return 0;
        }

        return score;
    } catch (_error) {
        return 0;
    }
}

export function scoreStudios(config, item) {
    try {
        const studiosArray =
            typeof item?.studios === 'string'
                ? JSON.parse(item.studios)
                : typeof item?.production_companies === 'string'
                    ? JSON.parse(item.production_companies)
                    : (item.studios || item.production_companies || []);

        const studios = studiosArray
            .map(s => (typeof s === 'string' ? s : s && s.name))
            .filter(Boolean)
            .map(s => s.toLowerCase());

        if (studios.length === 0) {
            if (config.require_any && config.require_any.length > 0) return 0;
            return 50;
        }

        let score = 50;

        if (config.require_any && config.require_any.length > 0) {
            const anyPresent = config.require_any.some(s => 
                studios.some(studio => studio.includes(s.toLowerCase()))
            );
            if (!anyPresent) return 0;
            score = 80;
        }

        if (config.prefer && config.prefer.length > 0) {
            const matchCount = config.prefer.filter(s => 
                studios.some(studio => studio.includes(s.toLowerCase()))
            ).length;
            const matchPercent = matchCount / config.prefer.length;
            score = Math.max(score, 50 + (matchPercent * 30));
        }

        return score;
    } catch (_error) {
        return 0;
    }
}

export function scoreReleaseYear(config, item) {
    try {
        const year = parseFiniteNumber(item.year);
        if (year === null) return 50;

        const min = parseFiniteNumber(config.min);
        const max = parseFiniteNumber(config.max);

        if (min !== null && year < min) return 0;
        if (max !== null && year > max) return 0;

        if (min !== null && max !== null) {
            return 100;
        } else if (min !== null || max !== null) {
            return 80;
        }

        return 50;
    } catch (_error) {
        return 0;
    }
}

export function scoreVoteAverage(config, item) {
    try {
        const rating = parseFiniteNumber(item.rating) ?? parseFiniteNumber(item.vote_average);
        if (rating === null) return 50;

        const min = parseFiniteNumber(config.min);
        const max = parseFiniteNumber(config.max);

        if (min !== null && rating < min) return 0;
        if (max !== null && rating > max) return 0;

        if (min !== null && max !== null) {
            return 100;
        } else if (min !== null || max !== null) {
            return 80;
        }

        return 50;
    } catch (_error) {
        return 0;
    }
}

export function scoreRuntime(config, item) {
    try {
        const runtime = parseFiniteNumber(item.runtime);
        if (runtime === null) return 50;

        const min = parseFiniteNumber(config.min_minutes);
        const max = parseFiniteNumber(config.max_minutes);

        if (min !== null && runtime < min) return 0;
        if (max !== null && runtime > max) return 0;

        if (min !== null && max !== null) {
            return 100;
        } else if (min !== null || max !== null) {
            return 80;
        }

        return 50;
    } catch (_error) {
        return 0;
    }
}

export function scoreLanguage(config, item) {
    try {
        const lang = (item.original_language || '').toLowerCase();
        if (!lang) return 50;

        let score = 50;

        if (config.require_any && config.require_any.length > 0) {
            const anyPresent = config.require_any.some(l => 
                l.toLowerCase() === lang
            );
            if (!anyPresent) return 0;
            score = 80;
        }

        if (config.prefer && config.prefer.length > 0) {
            const isPreferred = config.prefer.some(l => 
                l.toLowerCase() === lang
            );
            if (isPreferred) {
                score = Math.max(score, 90);
            }
        }

        if (config.exclude && config.exclude.length > 0) {
            const isExcluded = config.exclude.some(l => 
                l.toLowerCase() === lang
            );
            if (isExcluded) return 0;
        }

        return score;
    } catch (_error) {
        return 0;
    }
}

export function scoreMediaType(config, item) {
    try {
        const mediaType = item.media_type?.toLowerCase();
        if (!mediaType) return 50;

        const included = (config.include || []).map(t => t.toLowerCase());
        return included.includes(mediaType) ? 100 : 0;
    } catch (_error) {
        return 0;
    }
}

export function evaluatePresetSignals(signals, item) {
    try {
        if (!signals) {
            return 0;
        }

        const scores = [];
        let totalWeight = 0;
        let hasAffirmativeEvidence = false;
        let matchedAffirmativeEvidence = false;

        if (signals.certifications) {
            const score = scoreCertification(signals.certifications, item);
            const weight = signals.certifications.weight ?? 1.0;
            scores.push(score * weight);
            totalWeight += weight;
        }

        if (signals.genres) {
            const score = scoreGenres(signals.genres, item);
            if (signalCanEstablishIdentity('genres', signals.genres)) {
                hasAffirmativeEvidence = true;
                matchedAffirmativeEvidence ||= score > 50;
            }
            const weight = signals.genres.weight ?? 1.0;
            scores.push(score * weight);
            totalWeight += weight;
        }

        if (signals.keywords) {
            const score = scoreKeywords(signals.keywords, item);
            if (signalCanEstablishIdentity('keywords', signals.keywords)) {
                hasAffirmativeEvidence = true;
                matchedAffirmativeEvidence ||= score > 50;
            }
            const weight = signals.keywords.weight ?? 1.0;
            scores.push(score * weight);
            totalWeight += weight;
        }

        if (signals.studios) {
            const score = scoreStudios(signals.studios, item);
            if (signalCanEstablishIdentity('studios', signals.studios)) {
                hasAffirmativeEvidence = true;
                matchedAffirmativeEvidence ||= score > 50;
            }
            const weight = signals.studios.weight ?? 1.0;
            scores.push(score * weight);
            totalWeight += weight;
        }

        if (signals.release_year) {
            const score = scoreReleaseYear(signals.release_year, item);
            if (signalCanEstablishIdentity('release_year', signals.release_year)) {
                hasAffirmativeEvidence = true;
                matchedAffirmativeEvidence ||= score > 50;
            }
            const weight = signals.release_year.weight ?? 1.0;
            scores.push(score * weight);
            totalWeight += weight;
        }

        if (signals.vote_average) {
            const score = scoreVoteAverage(signals.vote_average, item);
            if (signalCanEstablishIdentity('vote_average', signals.vote_average)) {
                hasAffirmativeEvidence = true;
                matchedAffirmativeEvidence ||= score > 50;
            }
            const weight = signals.vote_average.weight ?? 1.0;
            scores.push(score * weight);
            totalWeight += weight;
        }

        if (signals.runtime) {
            const score = scoreRuntime(signals.runtime, item);
            if (signalCanEstablishIdentity('runtime', signals.runtime)) {
                hasAffirmativeEvidence = true;
                matchedAffirmativeEvidence ||= score > 50;
            }
            const weight = signals.runtime.weight ?? 1.0;
            scores.push(score * weight);
            totalWeight += weight;
        }

        if (signals.language) {
            const score = scoreLanguage(signals.language, item);
            if (score === 0 && policyExclusionService.hasStrictSignalConstraint(signals.language)) {
                return 0;
            }
            if (signalCanEstablishIdentity('language', signals.language)) {
                hasAffirmativeEvidence = true;
                matchedAffirmativeEvidence ||= score > 50;
            }
            const weight = signals.language.weight ?? 1.0;
            scores.push(score * weight);
            totalWeight += weight;
        }

        if (signals.media_type) {
            const score = scoreMediaType(signals.media_type, item);
            if (score === 0) {
                return 0;
            }
            if (signalCanEstablishIdentity('media_type', signals.media_type)) {
                hasAffirmativeEvidence = true;
                matchedAffirmativeEvidence ||= score > 50;
            }
            const weight = signals.media_type.weight ?? 1.0;
            scores.push(score * weight);
            totalWeight += weight;
        }

        if (totalWeight === 0) {
            return 0;
        }

        // Policy presets should only boost confidence when at least one
        // content-bearing signal contributes affirmative evidence. Broad
        // signals such as media_type or advisory language must not rescue a
        // niche preset whose identifying evidence did not match.
        if (hasAffirmativeEvidence && !matchedAffirmativeEvidence) {
            return 0;
        }

        const totalScore = scores.reduce((sum, s) => sum + s, 0);
        return totalScore / totalWeight;

    } catch (error) {
        logger.error('Failed to evaluate preset signals', { error: error.message });
        return 0;
    }
}
