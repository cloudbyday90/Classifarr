require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { testConnection } = require('./config/database');
const { initializeDiscordBot } = require('./services/discordBot');

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API Routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Serve Vue frontend (built static files)
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// Serve index.html for all non-API routes (SPA routing)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    const indexPath = path.join(publicPath, 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        // If index.html doesn't exist (dev mode), show a message
        res.status(200).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Classifarr</title>
            <style>
              body { 
                font-family: system-ui, -apple-system, sans-serif; 
                max-width: 800px; 
                margin: 100px auto; 
                padding: 20px;
                background: #1a1a1a;
                color: #fff;
              }
              h1 { color: #4CAF50; }
              .status { background: #2d2d2d; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .success { color: #4CAF50; }
              a { color: #2196F3; }
            </style>
          </head>
          <body>
            <h1>🎬 Classifarr</h1>
            <div class="status">
              <p class="success">✓ Backend server is running!</p>
              <p>The frontend is not built yet. This is normal if you're running in development mode.</p>
              <p>API is available at: <a href="/api">/api</a></p>
              <p>Health check: <a href="/api/health">/api/health</a></p>
            </div>
            <h2>Quick Links</h2>
            <ul>
              <li><a href="/api/health">Health Check</a></li>
              <li><a href="/api/classification/stats">Classification Stats</a></li>
              <li><a href="/api/libraries">Libraries</a></li>
            </ul>
          </body>
          </html>
        `);
      }
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
const PORT = process.env.PORT || 21324;

async function start() {
  try {
    console.log('🎬 Starting Classifarr...');
    
    // Test database connection
    await testConnection();
    
    // Initialize Discord bot
    console.log('🤖 Initializing Discord bot...');
    await initializeDiscordBot();
    
    // Start Express server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n✓ Classifarr is running!`);
      console.log(`  - Server: http://localhost:${PORT}`);
      console.log(`  - API: http://localhost:${PORT}/api`);
      console.log(`  - Health: http://localhost:${PORT}/api/health`);
      console.log(`\n📚 Ready to classify media!\n`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

start();
