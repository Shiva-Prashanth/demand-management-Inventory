/**
 * Wavelet Retail AI — Wavelet Decomposition Lab Tab Controller
 * Small-multiple time-frequency tracks with shared X axis and level controls
 */

import { api } from '../api.js';
import { state } from '../state.js';
import { chartsManager } from '../charts.js';
import { toast } from '../toast.js';

class WaveletTab {
  constructor() {
    this.storeId = 'S001';
    this.productId = 'P0001';
  }

  async load() {
    try {
      const res = await api.getWavelet(this.storeId, this.productId);
      if (res.success && res.data) {
        state.state.wavelet.data = res.data;
        chartsManager.renderWaveletMultiples(
          'wavelet-raw-track-chart',
          'wavelet-trend-track-chart',
          'wavelet-spike-track-chart',
          res.data
        );

        // Update stats
        const lenEl = document.getElementById('wavelet-stat-timesteps');
        const coeffEl = document.getElementById('wavelet-stat-coeffs');
        if (lenEl) lenEl.textContent = `${res.data.signal_length} timesteps`;
        if (coeffEl) coeffEl.textContent = `${res.data.coeff_length} coefficients`;
      }
    } catch (err) {
      console.error('[WaveletTab Error]:', err);
      toast.error('Wavelet signal decomposition failed: ' + err.message);
    }
  }

  bindEvents() {
    const storeSel = document.getElementById('wavelet-store-select');
    const prodSel = document.getElementById('wavelet-product-select');
    const decompBtn = document.getElementById('btn-run-wavelet-decomp');

    if (storeSel) {
      storeSel.addEventListener('change', (e) => {
        this.storeId = e.target.value;
      });
    }

    if (prodSel) {
      prodSel.addEventListener('change', (e) => {
        this.productId = e.target.value;
      });
    }

    if (decompBtn) {
      decompBtn.addEventListener('click', () => {
        this.load();
        toast.info(`Decomposing demand for Store ${this.storeId} / SKU ${this.productId}`);
      });
    }
  }
}

export const waveletTab = new WaveletTab();
