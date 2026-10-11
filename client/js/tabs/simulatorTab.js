/**
 * Wavelet Retail AI — Scenario Simulator Tab Controller
 * Two-column simulator layout with live baseline vs scenario curves and save/compare features
 */

import { api } from '../api.js';
import { chartsManager } from '../charts.js';
import { toast } from '../toast.js';

class SimulatorTab {
  constructor() {
    this.params = {
      storeId: 'S001',
      productId: 'P0001',
      price: 50.0,
      competitorPrice: 52.0,
      inventory: 150,
      promotion: 0,
      discount: 5,
      epidemic: 0.0,
      weather: 'Sunny',
      seasonality: 'Summer'
    };
    this.savedScenarios = [];
  }

  async runSimulation() {
    const btn = document.getElementById('btn-run-sim-forecast');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Calculating Dual-RF...';
    }

    try {
      const payload = {
        store_id: this.params.storeId,
        product_id: this.params.productId,
        features: {
          Price: parseFloat(this.params.price),
          'Competitor Pricing': parseFloat(this.params.competitorPrice),
          'Inventory Level': parseFloat(this.params.inventory),
          Promotion: parseFloat(this.params.promotion),
          Discount: parseFloat(this.params.discount),
          Epidemic: parseFloat(this.params.epidemic),
          'Weather Condition': this.params.weather,
          Seasonality: this.params.seasonality
        }
      };

      const res = await api.predict(payload);
      if (res.success && res.data) {
        const d = res.data;
        const baselineVal = 145.0; // historical mean baseline
        const predictedVal = d.reconstructed_demand;

        // Update Delta Summary Card
        const unitDiff = predictedVal - baselineVal;
        const unitPct = ((unitDiff / baselineVal) * 100).toFixed(1);

        const revBaseline = baselineVal * 50;
        const revSim = predictedVal * this.params.price;
        const revDiff = revSim - revBaseline;
        const revPct = ((revDiff / revBaseline) * 100).toFixed(1);

        const deltaUnitsEl = document.getElementById('sim-delta-units');
        const deltaRevEl = document.getElementById('sim-delta-revenue');
        const heroDemandEl = document.getElementById('sim-hero-demand-val');

        if (heroDemandEl) heroDemandEl.textContent = Math.round(predictedVal).toLocaleString();

        if (deltaUnitsEl) {
          const isUp = unitDiff >= 0;
          deltaUnitsEl.innerHTML = `<span style="color:${isUp ? 'var(--trend-up)' : 'var(--trend-down)'}; font-weight:700;">${isUp ? '▲ +' : '▼ '}${unitPct}%</span> vs Baseline`;
        }

        if (deltaRevEl) {
          const isUp = revDiff >= 0;
          deltaRevEl.innerHTML = `<span style="color:${isUp ? 'var(--trend-up)' : 'var(--trend-down)'}; font-weight:700;">${isUp ? '▲ +' : '▼ '}${revPct}%</span> vs Baseline`;
        }

        // Synthesize 10-day curve for Baseline vs Scenario comparison
        const baselineSeries = [];
        const scenarioSeries = [];
        for (let i = 1; i <= 10; i++) {
          baselineSeries.push(Math.round(baselineVal * (1 + Math.sin(i * 0.5) * 0.08)));
          scenarioSeries.push(Math.round(predictedVal * (1 + Math.sin(i * 0.5) * 0.08)));
        }

        chartsManager.renderScenarioChart('sim-comparison-chart', baselineSeries, scenarioSeries);
        toast.success('Simulation updated: ' + Math.round(predictedVal) + ' units projected.');
      }
    } catch (err) {
      console.error('[Simulator Error]:', err);
      toast.error('Simulation failed: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Run AI Simulation';
      }
    }
  }

  saveScenario() {
    const heroDemandEl = document.getElementById('sim-hero-demand-val');
    const predVal = heroDemandEl ? heroDemandEl.textContent : '150';

    const item = {
      id: Date.now(),
      name: `Scenario #${this.savedScenarios.length + 1} ($${this.params.price}, ${this.params.discount}%)`,
      price: this.params.price,
      discount: this.params.discount,
      promo: this.params.promotion > 0 ? 'Active' : 'Off',
      predicted: predVal
    };

    this.savedScenarios.unshift(item);
    if (this.savedScenarios.length > 5) this.savedScenarios.pop();
    this.renderSavedList();
    toast.success('Scenario saved to comparison list.');
  }

  renderSavedList() {
    const listEl = document.getElementById('sim-saved-scenarios-list');
    if (!listEl) return;

    if (this.savedScenarios.length === 0) {
      listEl.innerHTML = `<div style="font-size:0.75rem; color:var(--text-muted); padding:0.5rem 0;">No saved scenarios yet.</div>`;
      return;
    }

    listEl.innerHTML = this.savedScenarios.map(s => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0.65rem; background:var(--bg-surface-2); border-radius:6px; font-size:0.78rem; border:1px solid var(--border);">
        <div>
          <strong style="color:var(--text-primary);">${s.name}</strong>
          <span style="color:var(--text-muted); font-size:0.72rem; margin-left:0.5rem;">${s.promo}</span>
        </div>
        <div style="font-family:var(--font-mono); font-weight:700; color:var(--accent-secondary);">
          ${s.predicted} units
        </div>
      </div>
    `).join('');
  }

  bindEvents() {
    const bind = (id, key, valId, prefix = '', suffix = '') => {
      const el = document.getElementById(id);
      const valEl = document.getElementById(valId);
      if (el) {
        el.addEventListener('input', (e) => {
          this.params[key] = parseFloat(e.target.value);
          if (valEl) valEl.textContent = `${prefix}${e.target.value}${suffix}`;
        });
      }
    };

    bind('sim-slider-price', 'price', 'sim-val-price', '$');
    bind('sim-slider-comp', 'competitorPrice', 'sim-val-comp', '$');
    bind('sim-slider-inv', 'inventory', 'sim-val-inv');
    bind('sim-slider-discount', 'discount', 'sim-val-discount', '', '%');
    bind('sim-slider-epidemic', 'epidemic', 'sim-val-epidemic');

    document.getElementById('sim-select-promo')?.addEventListener('change', (e) => {
      this.params.promotion = parseFloat(e.target.value);
    });

    document.getElementById('sim-select-weather')?.addEventListener('change', (e) => {
      this.params.weather = e.target.value;
    });

    document.getElementById('sim-select-season')?.addEventListener('change', (e) => {
      this.params.seasonality = e.target.value;
    });

    document.getElementById('sim-select-store')?.addEventListener('change', (e) => {
      this.params.storeId = e.target.value;
    });

    document.getElementById('sim-select-product')?.addEventListener('change', (e) => {
      this.params.productId = e.target.value;
    });

    document.getElementById('btn-run-sim-forecast')?.addEventListener('click', () => {
      this.runSimulation();
    });

    document.getElementById('btn-save-scenario')?.addEventListener('click', () => {
      this.saveScenario();
    });
  }
}

export const simulatorTab = new SimulatorTab();
