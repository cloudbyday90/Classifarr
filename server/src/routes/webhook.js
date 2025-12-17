const express = require('express');
const router = express.Router();
const axios = require('axios');
const classificationService = require('../services/classification');
const discordService = require('../services/discord');
const db = require('../db');

/**
 * POST /api/webhook/overseerr
 * Handle incoming webhooks from Overseerr
 */
router.post('/overseerr', async (req, res) => {
  try {
    const payload = req.body;

    console.log('Received Overseerr webhook:', payload.notification_type);

    // Only process media requests
    if (payload.notification_type !== 'MEDIA_PENDING' && 
        payload.notification_type !== 'MEDIA_APPROVED') {
      console.log('Ignoring non-request notification');
      return res.json({ success: true, message: 'Notification type ignored' });
    }

    // Extract media information
    const mediaData = extractMediaData(payload);

    if (!mediaData) {
      console.error('Failed to extract media data from payload');
      return res.status(400).json({
        error: 'Invalid payload format',
      });
    }

    // Enrich with TMDB data if needed
    const enrichedData = await enrichWithTMDB(mediaData);

    // Perform classification
    console.log('Classifying:', enrichedData.title);
    const classification = await classificationService.classifyMedia(enrichedData);

    // Save classification to database
    const classificationId = await classificationService.saveClassification(
      classification,
      enrichedData
    );

    // Route to appropriate service (Radarr/Sonarr)
    const routingResult = await routeToService(
      enrichedData,
      classification.libraryId
    );

    // Send Discord notification
    await discordService.sendClassificationNotification(
      classification,
      classificationId,
      enrichedData
    );

    res.json({
      success: true,
      classification: {
        library: classification.library,
        confidence: classification.confidence,
        method: classification.method,
      },
      routing: routingResult,
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({
      error: 'Webhook processing failed',
      message: error.message,
    });
  }
});

/**
 * Extract media data from Overseerr payload
 * @param {Object} payload - Overseerr webhook payload
 * @returns {Object|null} Extracted media data
 */
function extractMediaData(payload) {
  try {
    const media = payload.media;
    const request = payload.request;

    if (!media) return null;

    const mediaType = media.media_type === 'tv' ? 'tv' : 'movie';

    return {
      tmdbId: media.tmdbId,
      mediaType,
      title: media.tmdbId ? (mediaType === 'movie' ? media.title : media.name) : 'Unknown',
      year: media.releaseDate ? new Date(media.releaseDate).getFullYear() : null,
      genres: media.genres || [],
      keywords: media.keywords || [],
      certification: media.certification || null,
      overview: media.overview || '',
      posterUrl: media.posterPath ? `https://image.tmdb.org/t/p/w500${media.posterPath}` : null,
      requestedBy: request?.requestedBy?.displayName || 'Unknown',
      metadata: {
        overseerrRequestId: request?.id,
        voteAverage: media.voteAverage,
        voteCount: media.voteCount,
        originalLanguage: media.originalLanguage,
      },
    };
  } catch (error) {
    console.error('Error extracting media data:', error);
    return null;
  }
}

/**
 * Enrich media data with additional TMDB information
 * @param {Object} mediaData - Basic media data
 * @returns {Promise<Object>} Enriched media data
 */
async enrichWithTMDB(mediaData) {
  try {
    const tmdbApiKey = process.env.TMDB_API_KEY;
    if (!tmdbApiKey) {
      console.warn('TMDB API key not configured, skipping enrichment');
      return mediaData;
    }

    const tmdbUrl = `https://api.themoviedb.org/3/${mediaData.mediaType}/${mediaData.tmdbId}`;
    
    const response = await axios.get(tmdbUrl, {
      params: {
        api_key: tmdbApiKey,
        append_to_response: 'keywords,release_dates,content_ratings',
      },
    });

    const tmdbData = response.data;

    // Extract genres
    if (tmdbData.genres && tmdbData.genres.length > 0) {
      mediaData.genres = tmdbData.genres.map(g => g.name);
    }

    // Extract keywords
    if (tmdbData.keywords) {
      const keywordList = mediaData.mediaType === 'movie' 
        ? tmdbData.keywords.keywords 
        : tmdbData.keywords.results;
      
      if (keywordList && keywordList.length > 0) {
        mediaData.keywords = keywordList.map(k => k.name);
      }
    }

    // Extract US certification/rating
    if (mediaData.mediaType === 'movie' && tmdbData.release_dates) {
      const usRelease = tmdbData.release_dates.results.find(r => r.iso_3166_1 === 'US');
      if (usRelease && usRelease.release_dates && usRelease.release_dates.length > 0) {
        const cert = usRelease.release_dates[0].certification;
        if (cert) mediaData.certification = cert;
      }
    } else if (mediaData.mediaType === 'tv' && tmdbData.content_ratings) {
      const usRating = tmdbData.content_ratings.results.find(r => r.iso_3166_1 === 'US');
      if (usRating) {
        mediaData.certification = usRating.rating;
      }
    }

    // Update year from release date
    if (tmdbData.release_date) {
      mediaData.year = new Date(tmdbData.release_date).getFullYear();
    } else if (tmdbData.first_air_date) {
      mediaData.year = new Date(tmdbData.first_air_date).getFullYear();
    }

    return mediaData;

  } catch (error) {
    console.error('TMDB enrichment error:', error.message);
    return mediaData; // Return original data if enrichment fails
  }
}

/**
 * Route media to Radarr or Sonarr
 * @param {Object} mediaData - Media information
 * @param {number} libraryId - Target library ID
 * @returns {Promise<Object>} Routing result
 */
async routeToService(mediaData, libraryId) {
  try {
    // Get library configuration
    const libraryResult = await db.query(
      'SELECT * FROM libraries WHERE id = $1',
      [libraryId]
    );

    if (libraryResult.rows.length === 0) {
      throw new Error('Library not found');
    }

    const library = libraryResult.rows[0];

    // Determine service URL and API key
    const serviceUrl = mediaData.mediaType === 'movie' 
      ? process.env.RADARR_URL 
      : process.env.SONARR_URL;
    
    const apiKey = mediaData.mediaType === 'movie'
      ? process.env.RADARR_API_KEY
      : process.env.SONARR_API_KEY;

    if (!serviceUrl || !apiKey) {
      console.warn(`${mediaData.mediaType === 'movie' ? 'Radarr' : 'Sonarr'} not configured`);
      return {
        routed: false,
        message: 'Service not configured',
      };
    }

    // Build request for Radarr/Sonarr
    const addRequest = {
      tmdbId: mediaData.tmdbId,
      title: mediaData.title,
      qualityProfileId: library.quality_profile_id || 1,
      rootFolderPath: library.root_folder || '/media',
      monitored: true,
      addOptions: {
        searchForMovie: true,
      },
    };

    // Add to Radarr/Sonarr
    const endpoint = mediaData.mediaType === 'movie' ? '/api/v3/movie' : '/api/v3/series';
    
    const response = await axios.post(
      `${serviceUrl}${endpoint}`,
      addRequest,
      {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`Added to ${mediaData.mediaType === 'movie' ? 'Radarr' : 'Sonarr'}:`, mediaData.title);

    return {
      routed: true,
      service: mediaData.mediaType === 'movie' ? 'radarr' : 'sonarr',
      library: library.name,
      serviceId: response.data.id,
    };

  } catch (error) {
    console.error('Routing error:', error.message);
    
    // If media already exists, that's okay
    if (error.response?.status === 400 && error.response?.data?.message?.includes('already')) {
      return {
        routed: false,
        message: 'Media already exists in service',
        error: error.response.data.message,
      };
    }

    return {
      routed: false,
      message: 'Routing failed',
      error: error.message,
    };
  }
}

/**
 * POST /api/webhook/test
 * Test webhook processing with sample data
 */
router.post('/test', async (req, res) => {
  try {
    const testPayload = req.body;

    const mediaData = extractMediaData(testPayload);

    res.json({
      success: true,
      extractedData: mediaData,
      message: 'Webhook payload parsed successfully',
    });
  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({
      error: 'Test failed',
      message: error.message,
    });
  }
});

module.exports = router;
