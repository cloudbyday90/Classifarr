/**
 * Test script to validate the classification flow system
 * Run this after setting up the database and environment
 */

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Test data
const testMovie = {
  tmdbId: 502356,
  mediaType: 'movie',
  title: 'The Super Mario Bros. Movie',
  year: 2023,
  genres: ['Animation', 'Adventure', 'Family', 'Fantasy', 'Comedy'],
  keywords: ['video game', 'based on video game', 'mario', 'mushroom kingdom'],
  certification: 'PG',
  overview: 'While working underground to fix a water main...',
  posterUrl: 'https://image.tmdb.org/t/p/w500/qNBAXBIQlnOThrVvA6mA2B5ggV6.jpg',
};

const testTVShow = {
  tmdbId: 94997,
  mediaType: 'tv',
  title: 'House of the Dragon',
  year: 2022,
  genres: ['Sci-Fi & Fantasy', 'Drama', 'Action & Adventure'],
  keywords: ['prequel', 'dragon', 'game of thrones'],
  certification: 'TV-MA',
  overview: 'The Targaryen dynasty is at the absolute apex...',
  posterUrl: 'https://image.tmdb.org/t/p/w500/17TTFFAXcg1hKAi1smsXsbpipru.jpg',
};

async function runTests() {
  console.log('🧪 Classifarr Classification System Tests\n');
  console.log('=' .repeat(60));

  try {
    // Test 1: Health check
    console.log('\n📋 Test 1: Health Check');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Server is running:', health.data);

    // Test 2: Get all label presets
    console.log('\n📋 Test 2: Get All Label Presets');
    const labels = await axios.get(`${BASE_URL}/api/labels`);
    console.log(`✅ Found ${labels.data.labels.length} label presets`);
    console.log('   Categories:', [...new Set(labels.data.labels.map(l => l.category))].join(', '));

    // Test 3: Get labels by category
    console.log('\n📋 Test 3: Get Labels by Category');
    const ratingLabels = await axios.get(`${BASE_URL}/api/labels/rating`);
    console.log(`✅ Found ${ratingLabels.data.labels.length} rating labels`);

    // Test 4: Create test library
    console.log('\n📋 Test 4: Create Test Library');
    try {
      const library = await axios.post(`${BASE_URL}/api/libraries`, {
        name: 'Family Movies',
        mediaType: 'movie',
        rootFolder: '/media/family',
        qualityProfileId: 1,
        description: 'Family-friendly movies for all ages',
      });
      console.log('✅ Created library:', library.data.library.name);
    } catch (error) {
      if (error.response?.status === 500 && error.response?.data?.message?.includes('duplicate')) {
        console.log('⚠️  Library already exists (OK for testing)');
      } else {
        throw error;
      }
    }

    // Test 5: Get libraries
    console.log('\n📋 Test 5: Get All Libraries');
    const libraries = await axios.get(`${BASE_URL}/api/libraries`);
    console.log(`✅ Found ${libraries.data.libraries.length} libraries`);
    
    if (libraries.data.libraries.length > 0) {
      const testLibraryId = libraries.data.libraries[0].id;
      
      // Test 6: Set library labels
      console.log('\n📋 Test 6: Set Library Labels');
      const setLabels = await axios.post(`${BASE_URL}/api/libraries/${testLibraryId}/labels`, {
        labels: [
          { labelPresetId: 1, isInclude: true }, // G rating
          { labelPresetId: 2, isInclude: true }, // PG rating
          { labelPresetId: 3, isInclude: true }, // PG-13 rating
        ],
      });
      console.log('✅ Set', setLabels.data.count, 'labels for library');

      // Test 7: Get library labels
      console.log('\n📋 Test 7: Get Library Labels');
      const libraryLabels = await axios.get(`${BASE_URL}/api/libraries/${testLibraryId}/labels`);
      console.log(`✅ Library has ${libraryLabels.data.labels.length} labels configured`);

      // Test 8: Add custom rule
      console.log('\n📋 Test 8: Add Custom Rule');
      const customRule = await axios.post(`${BASE_URL}/api/libraries/${testLibraryId}/rules`, {
        ruleName: 'Family-Friendly Action',
        ruleDescription: 'Action movies suitable for families',
        ruleLogic: {
          and: [
            { field: 'genres', operator: 'in', value: ['Action', 'Adventure'] },
            { field: 'certification', operator: 'in', value: ['G', 'PG', 'PG-13'] },
          ],
        },
        isInclude: true,
        priority: 10,
        enabled: true,
      });
      console.log('✅ Created custom rule:', customRule.data.rule.rule_name);

      // Test 9: Get library rules
      console.log('\n📋 Test 9: Get Library Rules');
      const libraryRules = await axios.get(`${BASE_URL}/api/libraries/${testLibraryId}/rules`);
      console.log(`✅ Library has ${libraryRules.data.rules.length} custom rules`);
    }

    // Test 10: Test classification (without saving)
    console.log('\n📋 Test 10: Test Classification');
    try {
      const classification = await axios.post(`${BASE_URL}/api/classify/test`, testMovie);
      console.log('✅ Classification result:');
      console.log('   Library:', classification.data.library);
      console.log('   Confidence:', classification.data.confidence + '%');
      console.log('   Method:', classification.data.method);
      console.log('   Reason:', classification.data.reason.substring(0, 100) + '...');
    } catch (error) {
      console.log('⚠️  Classification test failed (requires configured libraries)');
      console.log('   Error:', error.response?.data?.message || error.message);
    }

    // Test 11: Rule builder - start conversation
    console.log('\n📋 Test 11: Rule Builder - Start Conversation');
    if (libraries.data.libraries.length > 0) {
      const testLibraryId = libraries.data.libraries[0].id;
      try {
        const session = await axios.post(`${BASE_URL}/api/rule-builder/start`, {
          libraryId: testLibraryId,
          mediaType: 'movie',
        });
        console.log('✅ Started rule builder session:', session.data.sessionId);
        console.log('   Initial message:', session.data.message.substring(0, 100) + '...');

        // Test 12: Rule builder - send message
        console.log('\n📋 Test 12: Rule Builder - Send Message');
        const response = await axios.post(`${BASE_URL}/api/rule-builder/message`, {
          sessionId: session.data.sessionId,
          message: 'I want action movies with high ratings',
        });
        console.log('✅ Received response:', response.data.message.substring(0, 100) + '...');
      } catch (error) {
        console.log('⚠️  Rule builder test failed (requires Ollama)');
        console.log('   Error:', error.response?.data?.message || error.message);
      }
    }

    // Test 13: Webhook test
    console.log('\n📋 Test 13: Webhook - Parse Test Payload');
    const overseerrPayload = {
      notification_type: 'MEDIA_APPROVED',
      media: {
        tmdbId: testMovie.tmdbId,
        media_type: 'movie',
        title: testMovie.title,
        releaseDate: `${testMovie.year}-01-01`,
        genres: testMovie.genres,
        overview: testMovie.overview,
        posterPath: '/qNBAXBIQlnOThrVvA6mA2B5ggV6.jpg',
      },
      request: {
        id: 123,
        requestedBy: {
          displayName: 'Test User',
        },
      },
    };

    try {
      const webhookTest = await axios.post(`${BASE_URL}/api/webhook/test`, overseerrPayload);
      console.log('✅ Webhook parsing successful');
      console.log('   Extracted title:', webhookTest.data.extractedData.title);
      console.log('   Media type:', webhookTest.data.extractedData.mediaType);
    } catch (error) {
      console.log('❌ Webhook test failed:', error.response?.data?.message || error.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  console.log('Starting tests...\n');
  console.log('⚠️  Make sure the following are configured:');
  console.log('   - PostgreSQL database with schema initialized');
  console.log('   - .env file with database credentials');
  console.log('   - Server is running on', BASE_URL);
  console.log('   - (Optional) Ollama for AI classification');
  console.log('   - (Optional) Discord bot for notifications\n');

  runTests().catch(error => {
    console.error('Test suite failed:', error.message);
    process.exit(1);
  });
}

module.exports = { runTests };
