const axios = require('axios');
const config = require('../config');

class MLService {
  constructor() {
    this.client = axios.create({
      baseURL: config.mlServiceUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async getHealth() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (err) {
      console.error('[MLService] Health check failed:', err.message);
      return { status: 'down', error: err.message };
    }
  }

  async getMetrics() {
    try {
      const response = await this.client.get('/metrics');
      return response.data;
    } catch (err) {
      console.error('[MLService] Error fetching metrics:', err.message);
      const message = err.response?.data?.detail || err.message;
      throw new Error(`ML Service metrics error: ${message}`);
    }
  }

  async getFeatureImportance() {
    try {
      const response = await this.client.get('/feature-importance');
      return response.data;
    } catch (err) {
      console.error('[MLService] Error fetching feature importance:', err.message);
      const message = err.response?.data?.detail || err.message;
      throw new Error(`ML Service feature importance error: ${message}`);
    }
  }

  async predict(payload) {
    try {
      const response = await this.client.post('/predict', payload);
      return response.data;
    } catch (err) {
      console.error('[MLService] Error during prediction:', err.message);
      const detail = err.response?.data?.detail;
      let errorMsg = 'Failed to execute forecast model prediction.';
      if (Array.isArray(detail)) {
        errorMsg = detail.map((d) => d.msg || JSON.stringify(d)).join(', ');
      } else if (typeof detail === 'string') {
        errorMsg = detail;
      } else if (err.message) {
        errorMsg = err.message;
      }
      const error = new Error(errorMsg);
      error.statusCode = err.response?.status || 500;
      throw error;
    }
  }

  async getWaveletDecomposition(storeId, productId) {
    try {
      const response = await this.client.get('/wavelet-decomposition', {
        params: { store_id: storeId, product_id: productId }
      });
      return response.data;
    } catch (err) {
      console.error('[MLService] Error fetching wavelet decomposition:', err.message);
      const message = err.response?.data?.detail || err.message;
      const error = new Error(`Wavelet decomposition error: ${message}`);
      error.statusCode = err.response?.status || 500;
      throw error;
    }
  }
}

module.exports = new MLService();
