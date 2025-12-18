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
const discordBot = require('./services/discordBot');

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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

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
}

// Start server
async function startServer() {
  try {
    // Test database connection
    await db.query('SELECT 1');
    console.log('Database connected successfully');

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
