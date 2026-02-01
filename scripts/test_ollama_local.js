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


const axios = require('axios');

// Get IP from command line args, or default to localhost
const targetIp = process.argv[2] || 'localhost';
const port = 11434;
const url = `http://${targetIp}:${port}`;

console.log(`Testing connection to Ollama at: ${url}`);

async function testConnection() {
    try {
        const start = Date.now();
        // 1. Test basic connectivity (Tags endpoint)
        console.log('1. Checking server status...');
        const response = await axios.get(`${url}/api/tags`, { timeout: 5000 });

        const latency = Date.now() - start;
        console.log(`✅ Success! Server is reachable (${latency}ms)`);
        console.log(`   Found ${response.data.models.length} models.`);

        // 2. List Models
        console.log('\n2. Available Models:');
        response.data.models.forEach(m => {
            console.log(`   - ${m.name} (${Math.round(m.size / 1024 / 1024 / 1024)}GB)`);
        });

    } catch (error) {
        console.log('\n❌ Connection Failed!');
        if (error.code === 'ECONNREFUSED') {
            console.log(`   Error: The machine at ${targetIp} refused the connection.`);
            console.log('   Troubleshooting:');
            console.log('   1. Is Ollama running? (Check taskbar)');
            console.log('   2. Did you set OLLAMA_HOST=0.0.0.0 env var?');
            console.log('   3. Is Windows Firewall blocking port 11434?');
        } else if (error.code === 'ETIMEDOUT') {
            console.log(`   Error: Connection timed out.`);
            console.log('   Troubleshooting:');
            console.log('   1. Is the IP address correct?');
            console.log('   2. Are both machines on the same network?');
        } else {
            console.log(`   Error: ${error.message}`);
        }
    }
}

testConnection();
