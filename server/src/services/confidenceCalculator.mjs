import { DEFAULT_WEIGHTS } from './confidenceCalculationEngineDefaults.mjs';
import { calculate as engineCalculate, toAIContext as engineToAIContext } from './confidenceCalculationEngine.mjs';
import {
    loadWeights as persistLoadWeights,
    saveWeights as persistSaveWeights,
    saveThreshold as persistSaveThreshold
} from './confidenceSettingsPersistence.mjs';

class ConfidenceCalculator {
    constructor() {
        this.weights = { ...DEFAULT_WEIGHTS };
        this.threshold = 80;
    }

    getWeight(signalType) {
        return this.weights[signalType] || 0;
    }

    getThreshold() {
        return this.threshold;
    }

    calculate(signals) {
        return engineCalculate(signals, {
            weights: this.weights,
            threshold: this.threshold,
            getWeight: (type) => this.getWeight(type)
        });
    }

    toAIContext(calculationResult) {
        return engineToAIContext(calculationResult);
    }

    async loadWeights() {
        const result = await persistLoadWeights(DEFAULT_WEIGHTS);
        if (result.weights) {
            this.weights = { ...DEFAULT_WEIGHTS, ...result.weights };
        }
        if (result.threshold !== null) {
            this.threshold = result.threshold;
        }
    }

    async saveWeights(weights) {
        await persistSaveWeights(weights);
        this.weights = { ...DEFAULT_WEIGHTS, ...weights };
    }

    async saveThreshold(threshold) {
        await persistSaveThreshold(threshold);
        this.threshold = threshold;
    }

    getWeights() {
        return { ...this.weights };
    }

    getDefaultWeights() {
        return { ...DEFAULT_WEIGHTS };
    }
}

export const confidenceCalculator = new ConfidenceCalculator();
