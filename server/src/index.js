/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
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

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const db = require('./config/database');
const apiRouter = require('./routes/api');
const setupRouter = require('./routes/setup');
const authRouter = require('./routes/auth');
const systemRouter = require('./routes/system');
const discordBot = require('./services/discordBot');
const queueService = require('./services/queueService');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 21324;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Classifarr API',
      version: '1.0.0',
      description: 'AI-powered media classification for the *arr ecosystem',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
      },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// API Routes
app.use('/api/setup', setupRouter);  // Setup routes (no auth required)
app.use('/api/auth', authRouter);    // Auth routes
app.use('/api/system', systemRouter); // System routes (auth required)
app.use('/api', apiRouter);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../public')));

// Fallback to index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize Discord bot
async function initializeServices() {
  try {
    console.log('Initializing Discord bot...');
    await discordBot.initialize();
    console.log('Discord bot initialized successfully');
  } catch (error) {
    console.warn('Discord bot initialization failed:', error.message);
    console.warn('Continuing without Discord notifications...');
  }

  // Start queue worker
  try {
    queueService.startWorker();
    console.log('Queue worker started successfully');
  } catch (error) {
    console.warn('Queue worker start failed:', error.message);
  }

  // Start scheduler service
  try {
    const schedulerService = require('./services/scheduler');
    schedulerService.init(); // It was called init() in the class, but index.js called start(). Checked scheduler.js, it has init().
    console.log('Scheduler service started successfully');
  } catch (error) {
    console.warn('Scheduler service start failed:', error.message);
  }
}

// Start server
async function startServer() {
  try {
    // Test database connection
    await db.query('SELECT 1');
    console.log('Database connected successfully');

    // Run database migrations
    try {
      // Make tmdb_id nullable in classification_history to support items without TMDB IDs
      await db.query(`
        ALTER TABLE classification_history 
        ALTER COLUMN tmdb_id DROP NOT NULL
      `);
      console.log('Database migration: tmdb_id is now nullable');
    } catch (migrationError) {
      // Ignore if column is already nullable or table doesn't exist yet
      if (!migrationError.message.includes('does not exist') &&
        !migrationError.message.includes('already')) {
        console.log('Migration check for tmdb_id:', migrationError.message);
      }
    }

    // Initialize services
    await initializeServices();

    // Start listening
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Classifarr server running on port ${PORT}`);
      console.log(`API Documentation: http://localhost:${PORT}/api/docs`);
      console.log(`Health Check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
