const mlService = require('../services/mlService');

class ModelController {
  async getMetrics(req, res, next) {
    try {
      const metrics = await mlService.getMetrics();
      res.json({
        success: true,
        data: metrics
      });
    } catch (err) {
      next(err);
    }
  }

  async getFeatureImportance(req, res, next) {
    try {
      const importances = await mlService.getFeatureImportance();
      res.json({
        success: true,
        data: importances
      });
    } catch (err) {
      next(err);
    }
  }

  async getHealth(req, res, next) {
    try {
      const health = await mlService.getHealth();
      res.json({
        success: true,
        data: health
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ModelController();
