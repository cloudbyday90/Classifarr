/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import axios from 'axios';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

// Configuration
const TARGET_IP = '192.168.50.95';
const PORT = 11434;
const MODEL = 'gemma3:12b'; // Requested by user
const URL = `http://${TARGET_IP}:${PORT}/api/generate`;

// Mock Data for "Parenthood (2010)" (The movie that got stuck)
const mockMetadata = {
    title: 'Parenthood',
    year: '2010',
    media_type: 'tv',
    genres: ['Comedy', 'Drama'],
    certification: 'TV-14',
    original_language: 'en',
    keywords: ['family relationships', 'parenting', 'siblings', 'family drama', 'based on movie'],
    overview: 'The Braverman family shares the triumphs and heartaches of parenthood in Berkeley, California. ' +
        'This drama follows the lives of the four Braverman siblings and their parents as they ' +
        'navigate the joys and challenges of raising families of their own. ' +
        'The Braverman family shares the triumphs and heartaches of parenthood in Berkeley, California. '.repeat(20)
};

const mockLibraries = [
    { name: 'Movies', media_type: 'movie' },
    { name: 'TV Shows', media_type: 'tv' },
    { name: 'Kids TV', media_type: 'tv' },
    { name: 'Anime', media_type: 'tv' },
    { name: 'Documentaries', media_type: 'movie' }
];

let prompt = `You are a media classification assistant for a home media server. Your job is to determine which library a ${mockMetadata.media_type} belongs to.

CRITICAL RULES:
1. NEVER GUESS. If you are uncertain, you MUST ask for clarification.
2. Base your decision ONLY on verifiable data, not assumptions.
3. When there are conflicting signals (e.g., multiple genres that could route differently), ask for help.

--- MEDIA INFORMATION ---
Title: ${mockMetadata.title}
Year: ${mockMetadata.year}
Genres: ${mockMetadata.genres.join(', ')}
Certification: ${mockMetadata.certification}
Keywords: ${mockMetadata.keywords.join(', ')}
Original Language: ${mockMetadata.original_language}
Overview: ${mockMetadata.overview}

--- AVAILABLE LIBRARIES ---
${mockLibraries.map((lib, i) => `${i + 1}. "${lib.name}" (${lib.media_type})`).join('\n')}

--- YOUR RESPONSE ---
Analyze the media and respond in ONE of these two formats:

FORMAT 1 - If you are confident (can determine the correct library from the data):
CONFIDENT|<library_number>|<confidence_0_to_100>|<brief_reason>

Example: CONFIDENT|3|92|Japanese animation with anime keywords, clearly belongs in Anime library

FORMAT 2 - If you need clarification (conflicting signals, ambiguous data, or uncertain):
CLARIFY|<problem_summary>|<why_uncertain>|<question_to_ask>|<option1>|<option2>|<option3_optional>

Think step by step, then respond with ONLY one of the formats above.`;

async function runSimulation() {
    try {
        const response = await axios.post(URL, {
            model: MODEL,
            prompt,
            temperature: 0.3,
            stream: true,
        }, {
            responseType: 'stream',
            timeout: 180000
        });

        console.log('✅ Connection Established. Waiting for chunks...\n');

        let receivedDone = false;

        response.data.on('data', (chunk) => {
            const lines = chunk.toString().split('\n').filter(line => line.trim());
            for (const line of lines) {
                try {
                    const json = JSON.parse(line);

                    if (json.response) {
                        process.stdout.write(json.response);
                    }

                    if (json.done) {
                        receivedDone = true;
                        console.log('\n\n[EVENT] Received "done": true');
                        console.log(`[STATS] Total duration: ${(json.total_duration / 1e9).toFixed(2)}s`);
                        console.log(`[STATS] Eval count: ${json.eval_count} tokens`);
                    }
                } catch (_error) {
                    console.log(`\n[ERROR] Failed to parse JSON chunk: ${line.substring(0, 50)}...`);
                }
            }
        });

        response.data.on('end', () => {
            console.log('\n\n------------------------------------------------');
            console.log('🛑 Stream Ended (Connection finish)');
            if (receivedDone) {
                console.log("✅ SUCCESS: Stream ended normally with 'done' signal.");
            } else {
                console.log("❌ FAILURE: Stream ended WITHOUT 'done' signal!");
                console.log('   (This mimics the bug: Classifarr would hang here indefinitely)');
            }
            console.log('------------------------------------------------');
        });

        response.data.on('error', (err) => {
            console.log(`\n❌ Stream Error: ${err.message}`);
        });

    } catch (error) {
        console.error(`\n❌ Request Failed: ${error.message}`);
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Data: ${error.response.data}`);
        }
    }
}

function main() {
    console.log(`\n🌊 Starting Simulation: Classifarr -> Ollama (${TARGET_IP})`);
    console.log(`Target Model: ${MODEL}`);
    console.log(`Prompt Length: ${prompt.length} chars`);
    console.log(`Stream URL: ${URL}\n`);
    return runSimulation();
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
    await main();
}