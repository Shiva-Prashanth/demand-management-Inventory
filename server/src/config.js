const path = require('path');
require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 5000,
  host: process.env.HOST || '0.0.0.0',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:8000',
  dataPath: process.env.DATA_PATH
    ? path.resolve(__dirname, '..', process.env.DATA_PATH)
    : path.resolve(__dirname, '..', 'data', 'Demand Forecasting Dataset.csv'),
};
