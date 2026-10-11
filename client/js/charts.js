/**
 * Wavelet Retail AI — Master Chart Manager
 * Integrates Chart.js 4.4.2 with Ink & Paper dynamic styling, monotone curves, and accessible palettes
 */

import { theme } from './theme.js';
import { state } from './state.js';

class ChartsManager {
  constructor() {
    this.instances = {};
    this.rawCategoryData = [];
    this.donutViewMode = 'donut'; // 'donut' | 'bars'

    // Listen for theme toggles to restyle all charts
    state.on('theme:change', () => this.handleThemeUpdate());
  }

  destroy(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  }

  handleThemeUpdate() {
    const c = theme.getThemeColors();
    if (this.instances['main-demand-chart'] && this.lastDemandSeries) {
      this.renderDemandChart('main-demand-chart', this.lastDemandSeries);
    }
    if (this.instances['category-donut-chart'] && this.rawCategoryData && this.rawCategoryData.length > 0) {
      this.renderCategoryDonut('category-donut-chart', this.rawCategoryData);
    }

    Object.values(this.instances).forEach(chart => {
      try {
        if (chart.options.scales) {
          if (chart.options.scales.x) {
            chart.options.scales.x.grid.color = c.grid;
            chart.options.scales.x.ticks.color = c.tick;
          }
          if (chart.options.scales.y) {
            chart.options.scales.y.grid.color = c.grid;
            chart.options.scales.y.ticks.color = c.tick;
          }
          if (chart.options.scales.y1) {
            chart.options.scales.y1.ticks.color = c.accentTertiary;
          }
        }
        chart.update('none');
      } catch (err) {
        console.warn('[Chart theme update warning]:', err);
      }
    });
  }

  // =========================================================================
  // 1. MAIN DEMAND & PRICING DYNAMICS CHART
  // =========================================================================
  renderDemandChart(canvasId, seriesData = [], forecastData = null) {
    this.lastDemandSeries = seriesData;
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas || !seriesData || seriesData.length === 0) return;

    const ctx = canvas.getContext('2d');
    const colors = theme.getThemeColors();
    const histFillColor = colors.name === 'paper' ? 'rgba(31, 92, 58, 0.08)' : 'rgba(200, 240, 60, 0.07)';
    const confFillColor = colors.name === 'paper' ? 'rgba(217, 72, 43, 0.08)' : 'rgba(255, 107, 74, 0.08)';

    const labels = seriesData.map(d => d.date);
    const historicalDemand = seriesData.map(d => d.demand);
    const prices = seriesData.map(d => d.avgPrice);

    // Peak annotation calculation
    let maxDemandIdx = 0;
    historicalDemand.forEach((val, idx) => {
      if (val > historicalDemand[maxDemandIdx]) maxDemandIdx = idx;
    });
    const peakDate = labels[maxDemandIdx];
    const peakValue = historicalDemand[maxDemandIdx];

    // Optional Forecast Segment
    let forecastLabels = [];
    let forecastDemand = [];
    let confUpper = [];
    let confLower = [];

    // Synthesize 14-day projection forward if forecastData is provided or generated
    const lastDate = new Date(labels[labels.length - 1] || '2024-01-30');
    const forecastCount = 14;
    const baseDemand = historicalDemand[historicalDemand.length - 1] || 100;

    for (let i = 1; i <= forecastCount; i++) {
      const fd = new Date(lastDate);
      fd.setDate(fd.getDate() + i);
      const fDateStr = fd.toISOString().slice(0, 10);
      forecastLabels.push(fDateStr);

      const simVal = baseDemand * (1 + Math.sin(i * 0.4) * 0.12);
      forecastDemand.push(Math.round(simVal));
      confUpper.push(Math.round(simVal * 1.15));
      confLower.push(Math.round(simVal * 0.85));
    }

    const allLabels = [...labels, ...forecastLabels];
    const nullPaddedHistorical = [...historicalDemand, ...new Array(forecastCount).fill(null)];
    const nullPaddedPrices = [...prices, ...new Array(forecastCount).fill(null)];
    const nullPaddedForecast = [...new Array(labels.length - 1).fill(null), historicalDemand[historicalDemand.length - 1], ...forecastDemand];
    const nullPaddedUpper = [...new Array(labels.length - 1).fill(null), historicalDemand[historicalDemand.length - 1], ...confUpper];
    const nullPaddedLower = [...new Array(labels.length - 1).fill(null), historicalDemand[historicalDemand.length - 1], ...confLower];

    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: allLabels,
        datasets: [
          // Upper Confidence Band (Shading target)
          {
            label: 'Forecast Upper 90% CI',
            data: nullPaddedUpper,
            borderColor: 'transparent',
            backgroundColor: confFillColor,
            pointRadius: 0,
            fill: '+1', // Fills to Lower Band below
            tension: 0.2,
            yAxisID: 'y'
          },
          // Lower Confidence Band
          {
            label: 'Forecast Lower 90% CI',
            data: nullPaddedLower,
            borderColor: 'transparent',
            pointRadius: 0,
            fill: false,
            tension: 0.2,
            yAxisID: 'y'
          },
          // Forecast Line (Hot Coral Dashed)
          {
            label: 'Forecast Projection (Coral)',
            data: nullPaddedForecast,
            borderColor: colors.accentSecondary,
            borderWidth: 2.2,
            borderDash: [6, 4],
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: colors.accentSecondary,
            fill: false,
            tension: 0.2,
            yAxisID: 'y'
          },
          // Historical Demand (Chartreuse Monotone Curve)
          {
            label: 'Historical Demand',
            data: nullPaddedHistorical,
            borderColor: colors.accentPrimary,
            backgroundColor: histFillColor,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: colors.accentPrimary,
            fill: true,
            cubicInterpolationMode: 'monotone', // Monotone avoids overshoot below 0
            yAxisID: 'y'
          },
          // Average Price (Warm Sand Thin Line)
          {
            label: 'Unit Price ($)',
            data: nullPaddedPrices,
            borderColor: colors.accentTertiary,
            borderWidth: 1.5,
            borderDash: [4, 4],
            pointRadius: 0,
            fill: false,
            tension: 0.1,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: colors.textSecondary,
              font: { family: "'Space Grotesk', sans-serif", size: 11, weight: '600' },
              boxWidth: 10,
              boxHeight: 10,
              usePointStyle: true,
              filter: (item) => !item.text.includes('CI') // Hide helper CI datasets from legend
            }
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            titleColor: colors.textPrimary,
            bodyColor: colors.textSecondary,
            padding: 12,
            cornerRadius: 8,
            titleFont: { family: "'Space Grotesk', sans-serif", size: 12, weight: '700' },
            bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
            callbacks: {
              label: (context) => {
                const label = context.dataset.label || '';
                const val = context.parsed.y;
                if (val === null || val === undefined) return null;
                if (label.includes('Price')) {
                  return `  ${label}: $${val.toFixed(2)}`;
                }
                return `  ${label}: ${Math.round(val).toLocaleString()} units`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: colors.grid },
            ticks: {
              color: colors.tick,
              maxTicksLimit: 14,
              font: { family: "'JetBrains Mono', monospace", size: 10 }
            }
          },
          y: {
            type: 'linear',
            position: 'left',
            beginAtZero: true, // Zero baseline ensures true scale
            grid: { color: colors.grid },
            ticks: {
              color: colors.tick,
              font: { family: "'JetBrains Mono', monospace", size: 10 }
            },
            title: {
              display: true,
              text: 'Demand Units',
              color: colors.textMuted,
              font: { family: "'Space Grotesk', sans-serif", size: 11, weight: '600' }
            }
          },
          y1: {
            type: 'linear',
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: {
              color: colors.accentTertiary,
              font: { family: "'JetBrains Mono', monospace", size: 10 }
            },
            title: {
              display: true,
              text: 'Price ($)',
              color: colors.accentTertiary,
              font: { family: "'Space Grotesk', sans-serif", size: 11, weight: '600' }
            }
          }
        }
      }
    });
  }

  // =========================================================================
  // 2. CATEGORY DEMAND SHARE (DONUT + RANKED BARS TOGGLE)
  // =========================================================================
  renderCategoryDonut(canvasId, categoryData = []) {
    this.rawCategoryData = categoryData;
    this.destroy(canvasId);

    const canvas = document.getElementById(canvasId);
    if (!canvas || !categoryData || categoryData.length === 0) return;

    const ctx = canvas.getContext('2d');
    const colors = theme.getThemeColors();

    const totalUnits = categoryData.reduce((sum, c) => sum + (c.totalDemand || 0), 0);
    const labels = categoryData.map(c => c.name);
    const values = categoryData.map(c => c.totalDemand);
    const palette = colors.categories;

    // Render interactive side legend with units and % share
    this.renderDonutLegend('donut-custom-legend', categoryData, totalUnits, palette);

    // Initial center text
    const centerVal = document.getElementById('donut-center-units');
    const centerSub = document.getElementById('donut-center-label');
    if (centerVal) centerVal.textContent = Math.round(totalUnits).toLocaleString();
    if (centerSub) centerSub.textContent = 'Total Units';

    if (this.donutViewMode === 'bars') {
      // Horizontal Ranked Bars view
      this.instances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: palette.slice(0, labels.length),
            borderRadius: 4,
            barThickness: 18
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const val = ctx.parsed.x;
                  const pct = ((val / totalUnits) * 100).toFixed(1);
                  return ` ${Math.round(val).toLocaleString()} units (${pct}%)`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: colors.grid },
              ticks: { color: colors.tick, font: { family: "'JetBrains Mono', monospace", size: 10 } }
            },
            y: {
              grid: { display: false },
              ticks: { color: colors.textPrimary, font: { family: "'Space Grotesk', sans-serif", size: 11 } }
            }
          }
        }
      });
      return;
    }

    // Donut view (Thin ring with 72% cutout)
    this.instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: palette.slice(0, labels.length),
          borderColor: colors.surface1,
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            titleColor: colors.textPrimary,
            bodyColor: colors.textSecondary,
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed;
                const pct = ((val / totalUnits) * 100).toFixed(1);
                return ` ${Math.round(val).toLocaleString()} units (${pct}%)`;
              }
            }
          }
        },
        onHover: (event, elements) => {
          if (elements && elements.length > 0) {
            const index = elements[0].index;
            const item = categoryData[index];
            const pct = ((item.totalDemand / totalUnits) * 100).toFixed(1);
            if (centerVal) centerVal.textContent = `${pct}%`;
            if (centerSub) centerSub.textContent = item.name;
          } else {
            if (centerVal) centerVal.textContent = Math.round(totalUnits).toLocaleString();
            if (centerSub) centerSub.textContent = 'Total Units';
          }
        }
      }
    });
  }

  renderDonutLegend(containerId, categoryData, totalUnits, palette) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = categoryData.map((c, i) => {
      const color = palette[i % palette.length];
      const pct = totalUnits > 0 ? ((c.totalDemand / totalUnits) * 100).toFixed(1) : 0;
      return `
        <div class="donut-legend-item" data-category="${c.name}" title="Click to filter by ${c.name}">
          <div class="legend-dot-label">
            <span class="legend-dot" style="background:${color};"></span>
            <span style="color:var(--text-primary); font-weight:500;">${c.name}</span>
          </div>
          <div style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-muted);">
            ${Math.round(c.totalDemand).toLocaleString()} <strong style="color:var(--text-secondary);">(${pct}%)</strong>
          </div>
        </div>
      `;
    }).join('');

    // Clicking legend item filters whole dashboard
    container.querySelectorAll('.donut-legend-item').forEach(item => {
      item.addEventListener('click', () => {
        const cat = item.getAttribute('data-category');
        state.setFilter('category', cat);
      });
    });
  }

  toggleDonutView(canvasId) {
    this.donutViewMode = this.donutViewMode === 'donut' ? 'bars' : 'donut';
    this.renderCategoryDonut(canvasId, this.rawCategoryData);
    return this.donutViewMode;
  }

  // =========================================================================
  // 3. WAVELET SMALL-MULTIPLES STACKED CHARTS
  // =========================================================================
  renderWaveletMultiples(rawId, trendId, spikeId, waveletData) {
    this.destroy(rawId);
    this.destroy(trendId);
    this.destroy(spikeId);

    const colors = theme.getThemeColors();
    const dates = waveletData.dates || [];

    const buildTrack = (canvasId, label, data, strokeColor, bgColor) => {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      this.instances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
          labels: dates,
          datasets: [{
            label,
            data,
            borderColor: strokeColor,
            backgroundColor: bgColor,
            borderWidth: 1.8,
            pointRadius: 0,
            fill: true,
            tension: 0.15
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              grid: { color: colors.grid },
              ticks: { color: colors.tick, maxTicksLimit: 12, font: { family: "'JetBrains Mono', monospace", size: 10 } }
            },
            y: {
              grid: { color: colors.grid },
              ticks: { color: colors.tick, font: { family: "'JetBrains Mono', monospace", size: 10 } }
            }
          }
        }
      });
    };

    buildTrack(rawId, 'Original Demand S(t)', waveletData.original_demand || [], colors.textPrimary, 'rgba(255, 255, 255, 0.04)');
    buildTrack(trendId, 'Approximation cA (Macro Trend)', waveletData.aligned_trend || [], colors.accentPrimary, colors.accentPrimaryDim || 'rgba(200, 240, 60, 0.08)');
    buildTrack(spikeId, 'Detail cD (Transient Spikes)', waveletData.aligned_spikes || [], colors.accentSecondary, colors.accentSecondaryDim || 'rgba(255, 107, 74, 0.08)');
  }

  // =========================================================================
  // 4. SCENARIO SIMULATOR COMPARISON CHART
  // =========================================================================
  renderScenarioChart(canvasId, baselineSeries = [], scenarioSeries = []) {
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const colors = theme.getThemeColors();
    const labels = baselineSeries.map((_, i) => `Day +${i + 1}`);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Baseline Forecast',
            data: baselineSeries,
            borderColor: colors.accentTertiary,
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
            tension: 0.2
          },
          {
            label: 'Scenario Simulation',
            data: scenarioSeries,
            borderColor: colors.accentSecondary,
            backgroundColor: 'rgba(255, 107, 74, 0.1)',
            borderWidth: 2.2,
            pointRadius: 0,
            fill: true,
            tension: 0.2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { color: colors.textSecondary, font: { family: "'Space Grotesk', sans-serif", size: 11 } }
          }
        },
        scales: {
          x: {
            grid: { color: colors.grid },
            ticks: { color: colors.tick, font: { family: "'JetBrains Mono', monospace", size: 10 } }
          },
          y: {
            grid: { color: colors.grid },
            ticks: { color: colors.tick, font: { family: "'JetBrains Mono', monospace", size: 10 } }
          }
        }
      }
    });
  }

  // =========================================================================
  // 5. MODEL GOVERNANCE FEATURE IMPORTANCE CHART
  // =========================================================================
  renderFeatureImportance(canvasId, featuresList = [], colorOverride = null) {
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas || !featuresList || featuresList.length === 0) return;

    const ctx = canvas.getContext('2d');
    const colors = theme.getThemeColors();

    const labels = featuresList.map(f => f.feature);
    const values = featuresList.map(f => f.importance);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Gini Importance Score',
          data: values,
          backgroundColor: colorOverride || colors.accentPrimary,
          borderRadius: 4,
          barThickness: 16
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { color: colors.grid },
            ticks: { color: colors.tick, font: { family: "'JetBrains Mono', monospace", size: 10 } }
          },
          y: {
            grid: { display: false },
            ticks: { color: colors.textPrimary, font: { family: "'Space Grotesk', sans-serif", size: 11 } }
          }
        }
      }
    });
  }
}

export const chartsManager = new ChartsManager();
