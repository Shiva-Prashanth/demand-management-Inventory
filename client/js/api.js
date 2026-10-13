/**
 * Wavelet Retail AI — API Client Module (ESM)
 * Robust HTTP communication with latency profiling and warm-up handling
 */

const BASE_URL = window.location.protocol === 'file:'
  ? 'http://localhost:5001/api'
  : '/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  const startTime = performance.now();
  try {
    const response = await fetch(url, { ...options, headers });
    const data = await response.json();

    const duration = Math.round(performance.now() - startTime);

    if (response.status === 503) {
      return { ready: false, warming: true, status: 503, ...data };
    }

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    data._latency = duration;
    return data;
  } catch (error) {
    console.error(`[API Error] ${endpoint}:`, error.message);
    throw error;
  }
}

function toQueryString(params = {}) {
  const cleanParams = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '' && v !== 'ALL') {
      cleanParams[k] = v;
    }
  }
  const query = new URLSearchParams(cleanParams).toString();
  return query ? `?${query}` : '';
}

export const api = {
  baseUrl: BASE_URL,

  async pingStatus() {
    const start = performance.now();
    try {
      const serverHealth = await request('/health');
      const modelHealth = await request('/model/health');
      const latency = Math.round(performance.now() - start);

      const isReady = serverHealth.status === 'ok' && modelHealth.data?.models_loaded;
      return {
        ready: isReady,
        warming: modelHealth.data?.models_loaded === false,
        latency,
        server: serverHealth,
        model: modelHealth.data
      };
    } catch (err) {
      return {
        ready: false,
        warming: false,
        offline: true,
        latency: null,
        error: err.message
      };
    }
  },

  async getFilters() {
    return request('/demand/filters');
  },

  async getKpis(filters = {}) {
    const qs = toQueryString(filters);
    return request(`/demand/kpis${qs}`);
  },

  async getSeries(filters = {}) {
    const qs = toQueryString(filters);
    return request(`/demand/series${qs}`);
  },

  async getAggregated(groupBy = 'category', filters = {}) {
    const qs = toQueryString({ groupBy, ...filters });
    return request(`/demand/aggregate${qs}`);
  },

  async getWavelet(storeId, productId) {
    const qs = toQueryString({ storeId, productId });
    return request(`/demand/wavelet${qs}`);
  },

  async predict(payload) {
    return request('/forecast', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getMetrics() {
    return request('/model/metrics');
  },

  async getFeatureImportance() {
    return request('/model/feature-importance');
  },

  async getRawData(params = {}) {
    const qs = toQueryString(params);
    return request(`/demand/raw${qs}`);
  }
};
