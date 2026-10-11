const express = require('express');
const router = express.Router();
const modelController = require('../controllers/modelController');

// GET /api/model/metrics - Returns ML model evaluation metrics
router.get('/metrics', modelController.getMetrics.bind(modelController));

// GET /api/model/feature-importance - Returns feature importance scores
router.get('/feature-importance', modelController.getFeatureImportance.bind(modelController));

// GET /api/model/health - Returns ML service connectivity and status
router.get('/health', modelController.getHealth.bind(modelController));

module.exports = router;
