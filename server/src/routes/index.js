const express = require('express');
const router = express.Router();

const demandRoutes = require('./demandRoutes');
const forecastRoutes = require('./forecastRoutes');
const modelRoutes = require('./modelRoutes');

// API Routes
router.use('/demand', demandRoutes);
router.use('/forecast', forecastRoutes);
router.use('/model', modelRoutes);

// General health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'demand-forecasting-server'
  });
});

module.exports = router;
