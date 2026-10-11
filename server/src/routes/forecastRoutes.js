const express = require('express');
const router = express.Router();
const forecastController = require('../controllers/forecastController');

// POST /api/forecast - Run wavelet-based dual Random Forest inference
router.post('/', forecastController.forecast.bind(forecastController));

module.exports = router;
