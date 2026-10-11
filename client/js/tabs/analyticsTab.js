/**
 * Wavelet Retail AI — Analytics Tab Controller
 */

import { api } from '../api.js';
import { state } from '../state.js';
import { kpiManager } from '../kpi.js';
import { chartsManager } from '../charts.js';
import { toast } from '../toast.js';

class AnalyticsTab {
  constructor() {
    this.currentSeries = [];
  }

  async load() {
    const filters = state.get('filters');
    kpiManager.showSkeletons();

    try {
      // 1. Fetch KPIs & Series in parallel
      const [kpiRes, seriesRes, catRes] = await Promise.all([
        api.getKpis(filters),
        api.getSeries(filters),
        api.getAggregated('category', filters)
      ]);

      // 2. Handle warming up state if backend not ready
      if (kpiRes.ready === false || seriesRes.ready === false) {
        kpiManager.showSkeletons();
        toast.info('Dataset index is warming up, please wait...');
        return;
      }

      this.currentSeries = seriesRes.data || [];

      // 3. Update KPIs
      kpiManager.update(kpiRes.data, this.currentSeries);

      // 4. Render Main Monotone Chart
      chartsManager.renderDemandChart('main-demand-chart', this.currentSeries);

      // 5. Render Category Donut
      chartsManager.renderCategoryDonut('category-donut-chart', catRes.data || []);

    } catch (err) {
      console.error('[AnalyticsTab Error]:', err);
      toast.error('Failed to load analytics: ' + err.message);
    }
  }

  bindEvents() {
    // Donut view toggle (Donut <-> Bars)
    const donutToggle = document.getElementById('btn-toggle-donut-view');
    if (donutToggle) {
      donutToggle.addEventListener('click', () => {
        const mode = chartsManager.toggleDonutView('category-donut-chart');
        donutToggle.innerHTML = mode === 'bars'
          ? '<i class="fa-solid fa-chart-pie"></i>'
          : '<i class="fa-solid fa-chart-bar"></i>';
        toast.info(`Category view: ${mode === 'bars' ? 'Ranked Bars' : 'Donut'}`);
      });
    }

    // Export Main Chart PNG
    document.getElementById('btn-export-demand-png')?.addEventListener('click', () => {
      const chart = chartsManager.instances['main-demand-chart'];
      if (!chart) return;
      const url = chart.toBase64Image();
      const a = document.createElement('a');
      a.download = `wavelet-demand-forecast-${Date.now()}.png`;
      a.href = url;
      a.click();
      toast.success('Demand Chart PNG exported');
    });

    // Export Series CSV
    document.getElementById('btn-export-demand-csv')?.addEventListener('click', () => {
      if (!this.currentSeries || this.currentSeries.length === 0) return;
      let csv = 'Date,Demand,AveragePrice,HasPromotion\n';
      this.currentSeries.forEach(s => {
        csv += `${s.date},${s.demand},${s.avgPrice},${s.hasPromotion}\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = `demand-series-${Date.now()}.csv`;
      a.href = url;
      a.click();
      toast.success('Demand series CSV exported');
    });
  }
}

export const analyticsTab = new AnalyticsTab();
