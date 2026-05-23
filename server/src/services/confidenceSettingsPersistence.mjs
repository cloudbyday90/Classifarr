import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { parseConfiguredNumber } from './confidenceCalculationUtils.mjs';

const logger = createLogger('ConfidenceSettingsPersistence');

export async function loadWeights(DEFAULT_WEIGHTS) {
    try {
        const result = await db.query(
            `SELECT setting_key, setting_value 
             FROM confidence_settings 
             WHERE setting_key LIKE 'weight_%'`
        );

        const weights = {};
        for (const row of result.rows) {
            const signalType = row.setting_key.replace('weight_', '');
            const parsedWeight = parseConfiguredNumber(row.setting_value);
            if (parsedWeight !== null) {
                weights[signalType] = parsedWeight;
                continue;
            }

            if (Object.prototype.hasOwnProperty.call(DEFAULT_WEIGHTS, signalType)) {
                weights[signalType] = DEFAULT_WEIGHTS[signalType];
            }
        }

        let threshold = null;
        const thresholdResult = await db.query(
            `SELECT setting_value FROM confidence_settings WHERE setting_key = 'confidence_threshold'`
        );
        if (thresholdResult.rows.length > 0) {
            const parsedThreshold = parseConfiguredNumber(thresholdResult.rows[0].setting_value);
            if (parsedThreshold !== null) {
                threshold = parsedThreshold;
            }
        }

        logger.debug('Loaded confidence weights', { weights, threshold });

        return { weights, threshold };
    } catch (error) {
        logger.debug('Using default weights', { error: error.message });
        return { weights: null, threshold: null };
    }
}

export async function saveWeights(weights) {
    await db.withTransaction(async (client) => {
        for (const [signalType, weight] of Object.entries(weights)) {
            await client.query(
                `INSERT INTO confidence_settings (setting_key, setting_value)
                 VALUES ($1, $2)
                 ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2`,
                [`weight_${signalType}`, weight.toString()]
            );
        }
    });
    logger.info('Saved confidence weights', { weights });
}

export async function saveThreshold(threshold) {
    await db.query(
        `INSERT INTO confidence_settings (setting_key, setting_value)
         VALUES ('confidence_threshold', $1)
         ON CONFLICT (setting_key) DO UPDATE SET setting_value = $1`,
        [threshold.toString()]
    );
    logger.info('Saved confidence threshold', { threshold });
}
