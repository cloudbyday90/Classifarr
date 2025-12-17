const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const discordService = require('./services/discord');
const classificationRoutes = require('./routes/classification');
const ruleBuilderRoutes = require('./routes/ruleBuilder');
const webhookRoutes = require('./routes/webhook');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api', classificationRoutes);
app.use('/api/rule-builder', ruleBuilderRoutes);
app.use('/api/webhook', webhookRoutes);

// Library management routes
app.get('/api/libraries', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM libraries ORDER BY name ASC'
    );
    res.json({
      success: true,
      libraries: result.rows,
    });
  } catch (error) {
    console.error('Error fetching libraries:', error);
    res.status(500).json({
      error: 'Failed to fetch libraries',
      message: error.message,
    });
  }
});

app.post('/api/libraries', async (req, res) => {
  try {
    const {
      name,
      mediaType,
      radarrId,
      sonarrId,
      rootFolder,
      qualityProfileId,
      description,
    } = req.body;

    if (!name || !mediaType) {
      return res.status(400).json({
        error: 'name and mediaType are required',
      });
    }

    const result = await db.query(
      `INSERT INTO libraries 
       (name, media_type, radarr_id, sonarr_id, root_folder, quality_profile_id, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, mediaType, radarrId, sonarrId, rootFolder, qualityProfileId, description]
    );

    res.json({
      success: true,
      library: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating library:', error);
    res.status(500).json({
      error: 'Failed to create library',
      message: error.message,
    });
  }
});

app.put('/api/libraries/:id', async (req, res) => {
  try {
    const libraryId = parseInt(req.params.id);
    const {
      name,
      radarrId,
      sonarrId,
      rootFolder,
      qualityProfileId,
      description,
    } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (radarrId !== undefined) {
      updates.push(`radarr_id = $${paramCount++}`);
      values.push(radarrId);
    }
    if (sonarrId !== undefined) {
      updates.push(`sonarr_id = $${paramCount++}`);
      values.push(sonarrId);
    }
    if (rootFolder !== undefined) {
      updates.push(`root_folder = $${paramCount++}`);
      values.push(rootFolder);
    }
    if (qualityProfileId !== undefined) {
      updates.push(`quality_profile_id = $${paramCount++}`);
      values.push(qualityProfileId);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }

    updates.push(`updated_at = NOW()`);

    if (updates.length === 1) {
      return res.status(400).json({
        error: 'No fields to update',
      });
    }

    values.push(libraryId);

    const result = await db.query(
      `UPDATE libraries 
       SET ${updates.join(', ')}
       WHERE id = $${paramCount++}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Library not found',
      });
    }

    res.json({
      success: true,
      library: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating library:', error);
    res.status(500).json({
      error: 'Failed to update library',
      message: error.message,
    });
  }
});

app.delete('/api/libraries/:id', async (req, res) => {
  try {
    const libraryId = parseInt(req.params.id);

    const result = await db.query(
      'DELETE FROM libraries WHERE id = $1 RETURNING *',
      [libraryId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Library not found',
      });
    }

    res.json({
      success: true,
      message: 'Library deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting library:', error);
    res.status(500).json({
      error: 'Failed to delete library',
      message: error.message,
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// Start server
async function start() {
  try {
    // Test database connection
    await db.query('SELECT NOW()');
    console.log('Database connected successfully');

    // Initialize Discord bot
    await discordService.initialize();

    // Start Express server
    app.listen(PORT, () => {
      console.log(`Classifarr server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start the server
start();

module.exports = app;
