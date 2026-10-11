const express = require('express');
const router = express.Router();
const demandController = require('../controllers/demandController');

// GET /api/demand/filters - Returns unique filter values
router.get('/filters', demandController.getFilters.bind(demandController));

// GET /api/demand/kpis - Returns overall or filtered KPIs
router.get('/kpis', demandController.getKpis.bind(demandController));

// GET /api/demand/series - Returns daily time-series demand
router.get('/series', demandController.getDemandSeries.bind(demandController));

// GET /api/demand/aggregate - Returns aggregated demand by group
router.get('/aggregate', demandController.getAggregatedDemand.bind(demandController));

// GET /api/demand/wavelet - Returns wavelet decomposition for store & product
router.get('/wavelet', demandController.getWaveletDecomposition.bind(demandController));

// GET /api/demand/raw - Returns paginated, filtered raw records
router.get('/raw', demandController.getRawData.bind(demandController));

module.exports = router;
