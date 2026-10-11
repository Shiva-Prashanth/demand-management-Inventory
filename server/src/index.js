const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const routes = require('./routes');
const dataService = require('./services/dataService');

const app = express();

// Middleware
const corsOrigin = config.corsOrigin === '*' ? '*' : config.corsOrigin.split(',').map(s => s.trim());
app.use(cors({ origin: corsOrigin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging in development
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.originalUrl.startsWith('/api')) {
      console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
    }
  });
  next();
});

// API Routes
app.use('/api', routes);

// Serve Frontend Client Static Assets
const clientPath = path.resolve(__dirname, '../../client');
app.use(express.static(clientPath));

// Fallback to client/index.html for SPA routes (non-API)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: `Endpoint not found: ${req.path}` });
  }
  const indexPath = path.join(clientPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).send('Retail Demand Forecasting Dashboard client not found.');
    }
  });
});

// Global Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[ServerError]', err);
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Initialize Dataset and Start Server
async function startServer() {
  try {
    console.log('========================================================');
    console.log('  Wavelet Retail Demand Forecasting - Express Server');
    console.log('========================================================');

    // Preload dataset into memory
    await dataService.loadData();

    const server = app.listen(config.port, config.host, () => {
      console.log(`[Server] Express server running on: http://${config.host}:${config.port}`);
      console.log(`[Server] Dashboard URL:        http://localhost:${config.port}`);
      console.log(`[Server] API Base URL:         http://localhost:${config.port}/api`);
      console.log(`[Server] ML Service Target:    ${config.mlServiceUrl}`);
      console.log('========================================================');
    });

    // Graceful shutdown
    const handleShutdown = () => {
      console.log('\n[Server] Shutting down gracefully...');
      server.close(() => {
        console.log('[Server] HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);

  } catch (error) {
    console.error('[Server] Fatal error during startup:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
