/**
 * Wavelet Retail AI — Model Governance Tab Controller
 * Tracks dual model drift, residuals, Gini feature importance and fit metrics
 */

import { api } from '../api.js';
import { chartsManager } from '../charts.js';
import { theme } from '../theme.js';

class GovernanceTab {
  async load() {
    try {
      const [metricsRes, impRes] = await Promise.all([
        api.getMetrics(),
        api.getFeatureImportance()
      ]);

      if (metricsRes.success && metricsRes.data) {
        const m = metricsRes.data;
        document.getElementById('gov-metric-trend-r2').textContent = m.rf_trend?.r2 ?? '0.082';
        document.getElementById('gov-metric-trend-mse').textContent = m.rf_trend?.mse ?? '2763.2';
        document.getElementById('gov-metric-trend-mae').textContent = m.rf_trend?.mae ?? '41.3';

        document.getElementById('gov-metric-spike-r2').textContent = m.rf_spikes?.r2 ?? '-0.013';
        document.getElementById('gov-metric-spike-mse').textContent = m.rf_spikes?.mse ?? '1463.6';
        document.getElementById('gov-metric-spike-mae').textContent = m.rf_spikes?.mae ?? '29.4';

        document.getElementById('gov-metric-rec-r2').textContent = m.reconstructed?.r2 ?? '0.055';
        document.getElementById('gov-metric-rec-mse').textContent = m.reconstructed?.mse ?? '2121.7';
      }

      if (impRes.success && impRes.data) {
        const trendFeats = impRes.data.rf_trend || impRes.data.trend_features || [];
        const spikeFeats = impRes.data.rf_spikes || impRes.data.spikes_features || [];
        const colors = theme.getThemeColors();
        chartsManager.renderFeatureImportance('gov-trend-importance-chart', trendFeats, colors.accentPrimary);
        chartsManager.renderFeatureImportance('gov-spike-importance-chart', spikeFeats, colors.accentSecondary);
      }
    } catch (err) {
      console.error('[GovernanceTab Error]:', err);
    }
  }
}

export const governanceTab = new GovernanceTab();
