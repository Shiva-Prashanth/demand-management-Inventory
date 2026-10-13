const dataService = require('../services/dataService');
const mlService = require('../services/mlService');
const cacheService = require('../services/cacheService');

class DemandController {
  async getFilters(req, res, next) {
    try {
      if (!dataService.isLoaded) {
        return res.status(503).json({
          success: false,
          ready: false,
          message: 'In-memory dataset index is warming up...'
        });
      }

      const cacheKey = 'global_filters';
      const cached = cacheService.get(cacheKey);
      if (cached) {
        return res.json({ success: true, ready: true, data: cached, cached: true });
      }

      const filters = dataService.getFilters();
      if (filters && filters.stores && filters.stores.length > 0) {
        cacheService.set(cacheKey, filters, 300); // 5 min cache
      }
      res.json({ success: true, ready: true, data: filters, cached: false });
    } catch (err) {
      next(err);
    }
  }

  async getKpis(req, res, next) {
    try {
      if (!dataService.isLoaded) {
        return res.status(503).json({
          success: false,
          ready: false,
          message: 'In-memory dataset index is warming up...'
        });
      }

      const { storeId, productId, category, region, weather, seasonality, from, to } = req.query;

      // Normalized and sorted param object for deterministic cache keys
      const normalizedParams = {
        category: (category || 'ALL').trim().toUpperCase(),
        from: (from || '').trim(),
        productId: (productId || 'ALL').trim().toUpperCase(),
        region: (region || 'ALL').trim().toUpperCase(),
        seasonality: (seasonality || 'ALL').trim().toUpperCase(),
        storeId: (storeId || 'ALL').trim().toUpperCase(),
        to: (to || '').trim(),
        weather: (weather || 'ALL').trim().toUpperCase()
      };
      const cacheKey = `kpi_${JSON.stringify(normalizedParams)}`;

      const cached = cacheService.get(cacheKey);
      if (cached && cached.recordCount > 0) {
        return res.json({ success: true, ready: true, data: cached, cached: true });
      }

      const kpis = await dataService.getKpis({
        storeId,
        productId,
        category,
        region,
        weather,
        seasonality,
        from,
        to
      });

      // Never cache empty or uninitialized results
      if (kpis && kpis.recordCount > 0) {
        cacheService.set(cacheKey, kpis, 60); // 1 min cache
      }

      res.json({ success: true, ready: true, data: kpis, cached: false });
    } catch (err) {
      next(err);
    }
  }

  async getDemandSeries(req, res, next) {
    try {
      if (!dataService.isLoaded) {
        return res.status(503).json({
          success: false,
          ready: false,
          message: 'In-memory dataset index is warming up...'
        });
      }

      const { storeId, productId, category, region, weather, seasonality, from, to } = req.query;
      const series = await dataService.getTimeSeries({
        storeId,
        productId,
        category,
        region,
        weather,
        seasonality,
        from,
        to
      });

      res.json({
        success: true,
        ready: true,
        count: series.length,
        data: series
      });
    } catch (err) {
      next(err);
    }
  }

  async getAggregatedDemand(req, res, next) {
    try {
      if (!dataService.isLoaded) {
        return res.status(503).json({
          success: false,
          ready: false,
          message: 'In-memory dataset index is warming up...'
        });
      }

      const { groupBy = 'category', storeId, productId, category, region, weather, seasonality, from, to } = req.query;
      const validGroups = ['category', 'region', 'seasonality', 'weather', 'store', 'product'];
      const normalizedGroup = groupBy.toLowerCase();

      if (!validGroups.includes(normalizedGroup)) {
        return res.status(400).json({
          success: false,
          error: `Invalid groupBy parameter '${groupBy}'. Allowed: ${validGroups.join(', ')}`
        });
      }

      const aggregated = await dataService.getAggregated(normalizedGroup, {
        storeId,
        productId,
        category,
        region,
        weather,
        seasonality,
        from,
        to
      });

      res.json({
        success: true,
        ready: true,
        groupBy: normalizedGroup,
        data: aggregated
      });
    } catch (err) {
      next(err);
    }
  }

  async getWaveletDecomposition(req, res, next) {
    try {
      const { storeId, productId } = req.query;
      if (!storeId || !productId) {
        return res.status(400).json({
          success: false,
          error: "Query parameters 'storeId' and 'productId' are required."
        });
      }

      const result = await mlService.getWaveletDecomposition(storeId, productId);
      res.json({
        success: true,
        ready: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async getRawData(req, res, next) {
    try {
      if (!dataService.isLoaded) {
        return res.status(503).json({
          success: false,
          ready: false,
          message: 'In-memory dataset index is warming up...'
        });
      }

      const { page, limit, search, sortBy, sortOrder, storeId, productId, category, region, weather, seasonality, from, to } = req.query;
      const result = await dataService.getRawData({
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 25,
        search: search || '',
        sortBy: sortBy || 'date',
        sortOrder: sortOrder || 'desc',
        storeId,
        productId,
        category,
        region,
        weather,
        seasonality,
        from,
        to
      });

      res.json({
        success: true,
        ready: true,
        ...result
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DemandController();
