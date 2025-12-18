require('dotenv').config();
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const db = require('./config/database');
const apiRouter = require('./routes/api');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const discordBot = require('./services/discordBot');
const initializationService = require('./services/initialization');

const app = express();
const PORT = process.env.PORT || 21324;
const HTTPS_PORT = process.env.HTTPS_PORT || 21325;

// Enhanced security headers with helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Note: unsafe-inline is required for Vite development mode
      // In production, consider using nonces or hashes for inline scripts
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://image.tmdb.org"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

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
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        }
      }
    },
    security: [{
      bearerAuth: []
    }]
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
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

// Get SSL configuration from database
async function getSSLConfig() {
  try {
    const result = await db.query('SELECT * FROM ssl_config WHERE id = 1 LIMIT 1');
    return result.rows[0] || { enabled: false };
  } catch (error) {
    console.warn('Failed to get SSL config:', error.message);
    return { enabled: false };
  }
}

// Start server with HTTPS support
async function startServer() {
  try {
    // Test database connection
    await db.query('SELECT 1');
    console.log('✅ Database connected successfully');

    // Run first-run initialization
    await initializationService.initialize();

    // Initialize services
    await initializeServices();

    // Get SSL configuration
    const sslConfig = await getSSLConfig();
    
    if (sslConfig.enabled && sslConfig.cert_path && sslConfig.key_path) {
      // Check if certificate files exist
      if (fs.existsSync(sslConfig.cert_path) && fs.existsSync(sslConfig.key_path)) {
        try {
          const httpsOptions = {
            cert: fs.readFileSync(sslConfig.cert_path),
            key: fs.readFileSync(sslConfig.key_path),
            ca: sslConfig.ca_path && fs.existsSync(sslConfig.ca_path) 
              ? fs.readFileSync(sslConfig.ca_path) 
              : undefined,
            requestCert: sslConfig.client_cert_required || false,
            rejectUnauthorized: sslConfig.client_cert_required || false
          };
          
          // Start HTTPS server
          https.createServer(httpsOptions, app).listen(HTTPS_PORT, '0.0.0.0', () => {
            console.log(`🔒 HTTPS server running on port ${HTTPS_PORT}`);
          });
          
          // HTTP redirect to HTTPS if force_https is enabled
          if (sslConfig.force_https) {
            const redirectApp = express();
            redirectApp.use('*', (req, res) => {
              const host = req.headers.host.replace(`:${PORT}`, `:${HTTPS_PORT}`);
              res.redirect(301, `https://${host}${req.originalUrl}`);
            });
            redirectApp.listen(PORT, '0.0.0.0', () => {
              console.log(`↪️  HTTP redirect server running on port ${PORT} (redirecting to HTTPS)`);
            });
          } else {
            // Start HTTP server alongside HTTPS
            app.listen(PORT, '0.0.0.0', () => {
              console.log(`🌐 HTTP server running on port ${PORT}`);
            });
          }
          
          console.log(`📚 API Documentation: https://localhost:${HTTPS_PORT}/api/docs`);
          console.log(`❤️  Health Check: https://localhost:${HTTPS_PORT}/health`);
        } catch (error) {
          console.error('❌ Failed to start HTTPS server:', error.message);
          console.log('⚠️  Falling back to HTTP only...');
          startHTTPServer();
        }
      } else {
        console.warn('⚠️  SSL enabled but certificate files not found');
        console.log(`   Looking for: ${sslConfig.cert_path}, ${sslConfig.key_path}`);
        console.log('⚠️  Starting HTTP server only...');
        startHTTPServer();
      }
    } else {
      // Start HTTP only
      startHTTPServer();
    }
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start HTTP-only server
function startHTTPServer() {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 HTTP server running on port ${PORT}`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
    console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
  });
}

startServer();
