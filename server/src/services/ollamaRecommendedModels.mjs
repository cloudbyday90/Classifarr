/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const OLLAMA_RECOMMENDED_MODELS = [
  {
    name: 'phi3:3.8b',
    displayName: 'Phi-3 3.8B',
    size: '3.8B',
    vram: '4GB',
    speed: 'Fastest',
    accuracy: 'Good',
    description: 'Best for low-end GPUs (4GB VRAM)',
    recommended: false,
  },
  {
    name: 'mistral:7b',
    displayName: 'Mistral 7B',
    size: '7B',
    vram: '6GB',
    speed: 'Very Fast',
    accuracy: 'Good',
    description: 'Popular, well-tested (6GB VRAM)',
    recommended: false,
  },
  {
    name: 'gemma3:4b',
    displayName: 'Gemma 3 4B',
    size: '4B',
    vram: '8GB',
    speed: 'Very Fast',
    accuracy: 'High',
    description: 'Best balance of speed/accuracy (8GB VRAM)',
    recommended: true,
  },
  {
    name: 'gemma3:12b',
    displayName: 'Gemma 3 12B',
    size: '12B',
    vram: '12GB',
    speed: 'Fast',
    accuracy: 'Very High',
    description: 'Excellent for 12GB+ cards',
    recommended: true,
  },
  {
    name: 'qwen3:8b',
    displayName: 'Qwen 3 8B',
    size: '8B',
    vram: '12GB',
    speed: 'Fast',
    accuracy: 'High',
    description: 'Strong multilingual support',
    recommended: false,
  },
  {
    name: 'deepseek-r1:8b',
    displayName: 'DeepSeek R1 8B',
    size: '8B',
    vram: '16GB',
    speed: 'Fast',
    accuracy: 'Very High',
    description: 'Strong reasoning capabilities',
    recommended: false,
  },
  {
    name: 'qwen3:14b',
    displayName: 'Qwen 3 14B',
    size: '14B',
    vram: '16GB',
    speed: 'Medium',
    accuracy: 'Very High',
    description: 'Default model, excellent accuracy',
    recommended: false,
  },
  {
    name: 'gemma3:27b',
    displayName: 'Gemma 3 27B',
    size: '27B',
    vram: '24GB',
    speed: 'Medium',
    accuracy: 'Highest',
    description: 'Best accuracy for high-end GPUs',
    recommended: false,
  },
];

export function getRecommendedModels() {
  return OLLAMA_RECOMMENDED_MODELS;
}
