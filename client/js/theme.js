/**
 * Wavelet Retail AI — Theme Controller ("Ink" vs "Paper")
 * Reads dynamic CSS variables via getComputedStyle and notifies Chart.js
 */

import { state } from './state.js';

class ThemeManager {
  constructor() {
    this.currentTheme = 'ink';
    this.init();
  }

  init() {
    const saved = localStorage.getItem('wavelet_theme');
    if (saved === 'paper' || saved === 'ink') {
      this.setTheme(saved, false);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.setTheme(prefersDark ? 'ink' : 'paper', false);
    }

    // Listen for OS preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('wavelet_theme')) {
        this.setTheme(e.matches ? 'ink' : 'paper', true);
      }
    });
  }

  setTheme(themeName, persist = true) {
    this.currentTheme = themeName;
    state.state.currentTheme = themeName;

    if (themeName === 'paper') {
      document.documentElement.setAttribute('data-theme', 'paper');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    if (persist) {
      localStorage.setItem('wavelet_theme', themeName);
    }

    const colors = this.getThemeColors();
    state.emit('theme:change', { theme: themeName, colors });
  }

  toggle() {
    const next = this.currentTheme === 'ink' ? 'paper' : 'ink';
    this.setTheme(next, true);
    return next;
  }

  getThemeColors() {
    const styles = getComputedStyle(document.documentElement);
    const getVal = (v) => styles.getPropertyValue(v).trim();

    return {
      name: this.currentTheme,
      bgBase: getVal('--bg-base'),
      surface1: getVal('--bg-surface-1'),
      surface2: getVal('--bg-surface-2'),
      border: getVal('--border'),
      borderStrong: getVal('--border-strong'),
      textPrimary: getVal('--text-primary'),
      textSecondary: getVal('--text-secondary'),
      textMuted: getVal('--text-muted'),
      accentPrimary: getVal('--accent-primary'),
      accentSecondary: getVal('--accent-secondary'),
      accentTertiary: getVal('--accent-tertiary'),
      trendUp: getVal('--trend-up'),
      trendDown: getVal('--trend-down'),
      grid: getVal('--chart-grid'),
      tick: getVal('--chart-tick'),
      tooltipBg: getVal('--chart-tooltip-bg'),
      tooltipBorder: getVal('--chart-tooltip-border'),
      categories: [
        getVal('--cat-0') || '#C8F03C',
        getVal('--cat-1') || '#FF6B4A',
        getVal('--cat-2') || '#E8C99B',
        getVal('--cat-3') || '#2FB8A0',
        getVal('--cat-4') || '#C4552D',
        getVal('--cat-5') || '#7A8F3A',
        getVal('--cat-6') || '#E58FA0',
        getVal('--cat-7') || '#8C9A92'
      ]
    };
  }
}

export const theme = new ThemeManager();
