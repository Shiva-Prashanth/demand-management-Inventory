/**
 * Wavelet Retail AI — KPI Cards Manager
 * Features 600ms ease-out count-up, skeleton shimmer states, deltas and SVG sparklines
 */

import { state } from './state.js';
import { theme } from './theme.js';

class KpiManager {
  constructor() {
    this.prevValues = {};
    this.sparklines = {};
    this.lastSeriesData = null;

    state.on('theme:change', () => {
      this.renderCurrentSparklines();
    });
  }

  showSkeletons() {
    const ids = ['kpi-val-total', 'kpi-val-daily', 'kpi-val-record', 'kpi-val-stores', 'kpi-val-products'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add('skeleton');
        el.textContent = '----';
      }
    });

    const deltas = ['kpi-delta-total', 'kpi-delta-daily', 'kpi-delta-record', 'kpi-delta-stores', 'kpi-delta-products'];
    deltas.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
  }

  update(kpiData, seriesData = []) {
    const ids = ['kpi-val-total', 'kpi-val-daily', 'kpi-val-record', 'kpi-val-stores', 'kpi-val-products'];
    ids.forEach(id => document.getElementById(id)?.classList.remove('skeleton'));

    if (!kpiData || kpiData.recordCount === 0) {
      this.renderEmptyState();
      return;
    }

    // 1. Animate Count-up for each metric
    this.animateNumber('kpi-val-total', kpiData.totalDemand, 0);
    this.animateNumber('kpi-val-daily', kpiData.avgDailyDemand, 1);
    this.animateNumber('kpi-val-record', kpiData.avgDemandPerRecord, 1);
    this.animateNumber('kpi-val-stores', kpiData.storeCount, 0);
    this.animateNumber('kpi-val-products', kpiData.productCount, 0);

    // 2. Render Deltas
    this.renderDelta('kpi-delta-total', kpiData.totalDemand, this.prevValues.totalDemand || 7800000);
    this.renderDelta('kpi-delta-daily', kpiData.avgDailyDemand, this.prevValues.avgDailyDemand || 10200);
    this.renderDelta('kpi-delta-record', kpiData.avgDemandPerRecord, this.prevValues.avgDemandPerRecord || 100);
    this.renderDelta('kpi-delta-stores', kpiData.storeCount, kpiData.storeCount);
    this.renderDelta('kpi-delta-products', kpiData.productCount, kpiData.productCount);

    // Store for next delta
    this.prevValues = { ...kpiData };

    // 3. Render Mini Sparklines
    if (seriesData && seriesData.length > 0) {
      this.lastSeriesData = seriesData;
      this.renderCurrentSparklines();
    }

    // Aria live announcement
    const liveRegion = document.getElementById('kpi-live-announcer');
    if (liveRegion) {
      liveRegion.textContent = `KPIs updated: Total Demand ${Math.round(kpiData.totalDemand).toLocaleString()} units across ${kpiData.recordCount} records.`;
    }
  }

  renderEmptyState() {
    const ids = ['kpi-val-total', 'kpi-val-daily', 'kpi-val-record', 'kpi-val-stores', 'kpi-val-products'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = '—';
        el.title = 'No records found matching the current filter combination';
      }
    });

    const deltas = ['kpi-delta-total', 'kpi-delta-daily', 'kpi-delta-record', 'kpi-delta-stores', 'kpi-delta-products'];
    deltas.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.innerHTML = '<span class="kpi-delta neutral">No Data</span>';
      }
    });
  }

  animateNumber(elementId, targetValue, decimals = 0) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const start = parseFloat(el.getAttribute('data-value')) || 0;
    const end = parseFloat(targetValue) || 0;
    el.setAttribute('data-value', end);

    if (start === end) {
      el.textContent = end.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      return;
    }

    const duration = 600; // ms
    const startTime = performance.now();

    const updateFrame = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * ease;

      el.textContent = current.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });

      if (progress < 1) {
        requestAnimationFrame(updateFrame);
      } else {
        el.textContent = end.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        });
      }
    };

    requestAnimationFrame(updateFrame);
  }

  renderDelta(elementId, current, baseline) {
    const el = document.getElementById(elementId);
    if (!el) return;

    if (!baseline || baseline === current) {
      el.innerHTML = `<span class="kpi-delta neutral">• Steady</span>`;
      return;
    }

    const diff = current - baseline;
    const pct = ((diff / baseline) * 100).toFixed(1);
    const isUp = diff > 0;

    el.innerHTML = `
      <span class="kpi-delta ${isUp ? 'up' : 'down'}">
        <i class="fa-solid fa-arrow-${isUp ? 'up-right' : 'down-right'}"></i>
        ${isUp ? '+' : ''}${pct}%
      </span>
    `;
  }

  renderCurrentSparklines() {
    if (!this.lastSeriesData || this.lastSeriesData.length === 0) return;
    const recentPoints = this.lastSeriesData.slice(-30).map(s => s.demand);
    const sparkColor = theme.getThemeColors().accentPrimary;
    this.renderSvgSparkline('sparkline-total', recentPoints, sparkColor);
    this.renderSvgSparkline('sparkline-daily', recentPoints, sparkColor);
    this.renderSvgSparkline('sparkline-record', recentPoints, sparkColor);
  }

  renderSvgSparkline(containerId, points = [], color = '#C8F03C') {
    const container = document.getElementById(containerId);
    if (!container || points.length < 2) return;

    const width = 86;
    const height = 24;
    const min = Math.min(...points);
    const max = Math.max(...points) || 1;
    const range = (max - min) || 1;

    const coords = points.map((p, i) => {
      const x = (i / (points.length - 1)) * (width - 4) + 2;
      const y = height - 3 - ((p - min) / range) * (height - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    container.innerHTML = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">
        <polyline fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" points="${coords}" />
      </svg>
    `;
  }
}

export const kpiManager = new KpiManager();
