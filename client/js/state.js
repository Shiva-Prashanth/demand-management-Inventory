/**
 * Wavelet Retail AI — Central State Manager & Event Bus
 * Implements observable state pattern with fine-grained subscription channels.
 */

class StateManager {
  constructor() {
    this.state = {
      filters: {
        storeId: 'ALL',
        productId: 'ALL',
        category: 'ALL',
        region: 'ALL',
        weather: 'ALL',
        seasonality: 'ALL',
        from: '',
        to: ''
      },
      activeTab: 'analytics',
      currentTheme: 'ink', // 'ink' | 'paper'
      kpis: {
        loading: true,
        data: null,
        prevData: null,
        primaryMetric: 'totalDemand'
      },
      wavelet: {
        storeId: 'S001',
        productId: 'P0001',
        loading: false,
        data: null
      },
      simulator: {
        storeId: 'S001',
        productId: 'P0001',
        price: 50.0,
        competitorPricing: 52.0,
        inventoryLevel: 150,
        promotion: 0,
        discount: 5,
        epidemic: 0.0,
        weather: 'Sunny',
        seasonality: 'Summer',
        history: [],
        currentForecast: null
      },
      governance: {
        metrics: null,
        importance: null,
        loading: false
      },
      table: {
        page: 1,
        limit: 15,
        search: '',
        sortBy: 'date',
        sortOrder: 'desc',
        density: 'comfortable',
        total: 0,
        totalPages: 1
      }
    };

    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event).delete(callback);
  }

  emit(event, payload) {
    if (this.listeners.has(event)) {
      for (const cb of this.listeners.get(event)) {
        try {
          cb(payload, this.state);
        } catch (err) {
          console.error(`[State Error in listener ${event}]:`, err);
        }
      }
    }
  }

  get(path) {
    if (!path) return this.state;
    return path.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), this.state);
  }

  setFilter(key, value) {
    const prev = this.state.filters[key];
    if (prev !== value) {
      this.state.filters[key] = value;
      this.emit('filter:change', { key, value, filters: { ...this.state.filters } });
    }
  }

  setFilters(newFilters) {
    this.state.filters = { ...this.state.filters, ...newFilters };
    this.emit('filter:change', { filters: { ...this.state.filters } });
  }

  resetFilters() {
    this.state.filters = {
      storeId: 'ALL',
      productId: 'ALL',
      category: 'ALL',
      region: 'ALL',
      weather: 'ALL',
      seasonality: 'ALL',
      from: '',
      to: ''
    };
    this.emit('filter:reset', { filters: { ...this.state.filters } });
    this.emit('filter:change', { filters: { ...this.state.filters } });
  }

  setTab(tab) {
    if (this.state.activeTab !== tab) {
      this.state.activeTab = tab;
      this.emit('tab:change', tab);
    }
  }
}

export const state = new StateManager();
