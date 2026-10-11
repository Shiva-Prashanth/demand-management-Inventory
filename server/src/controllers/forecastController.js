const mlService = require('../services/mlService');

class ForecastController {
  async forecast(req, res, next) {
    try {
      const { store_id, storeId, product_id, productId, features } = req.body;
      const targetStore = store_id || storeId;
      const targetProduct = product_id || productId;

      if (!targetStore) {
        return res.status(400).json({
          success: false,
          error: "Missing required parameter 'storeId' or 'store_id'."
        });
      }

      if (!targetProduct) {
        return res.status(400).json({
          success: false,
          error: "Missing required parameter 'productId' or 'product_id'."
        });
      }

      if (!features) {
        return res.status(400).json({
          success: false,
          error: "Missing required parameter 'features'."
        });
      }

      const payload = {
        store_id: targetStore,
        product_id: targetProduct,
        features
      };

      const prediction = await mlService.predict(payload);

      res.json({
        success: true,
        data: prediction
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ForecastController();
