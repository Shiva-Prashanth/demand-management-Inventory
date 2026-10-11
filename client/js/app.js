/**
 * Wavelet Retail AI — Application Bootstrap & Orchestrator
 * Seamless ES module assembly, lifecycle control and responsive rail bindings
 */

import { state } from './state.js';
import { api } from './api.js';
import { theme } from './theme.js';
import { toast } from './toast.js';
import { filtersController } from './filters.js';
import { commandPalette } from './commandPalette.js';
import { analyticsTab } from './tabs/analyticsTab.js';
import { waveletTab } from './tabs/waveletTab.js';
import { simulatorTab } from './tabs/simulatorTab.js';
import { governanceTab } from './tabs/governanceTab.js';
import { explorerTab } from './tabs/explorerTab.js';

class AppBootstrap {
  constructor() {
    this.filterDebounceTimer = null;
    this.loadedTabs = new Set();
  }

  async init() {
    console.log('[Wavelet AI] Bootstrapping modular frontend architecture...');

    // 1. Process URL deep-link parameters synchronously first
    const urlParams = new URLSearchParams(window.location.search);
    const initialTheme = urlParams.get('theme');
    if (initialTheme === 'paper' || initialTheme === 'ink') {
      theme.setTheme(initialTheme, false);
    }

    const targetTab = urlParams.get('tab') || window.location.hash.replace('#', '') || 'analytics';
    const initialTab = ['analytics', 'wavelet', 'simulator', 'governance', 'explorer'].includes(targetTab) ? targetTab : 'analytics';
    state.state.activeTab = initialTab;

    // 2. Initialize UI components & bindings
    this.setupNavigation();
    this.setupStatusPill();
    commandPalette.init();
    analyticsTab.bindEvents();
    waveletTab.bindEvents();
    simulatorTab.bindEvents();
    explorerTab.bindEvents();

    // 3. Switch to initial tab in UI synchronously
    this.switchTabUI(initialTab);

    // 4. Wire tab switching subscription
    state.on('tab:change', (tabName) => {
      this.switchTabUI(tabName);
      this.loadTab(tabName);
    });

    // 5. Wire debounced filter subscription
    state.on('filter:change', () => {
      clearTimeout(this.filterDebounceTimer);
      this.filterDebounceTimer = setTimeout(() => {
        if (state.state.activeTab === 'analytics') analyticsTab.load();
        if (state.state.activeTab === 'explorer') explorerTab.load();
      }, 250);
    });

    // 6. Asynchronously start service ping and filter dimension loading
    this.pollStatus();
    this.loadFilters();

    // 7. Load requested tab data immediately
    await this.loadTab(initialTab);

    toast.success('Wavelet Retail AI ready • Dual-RF db4 models loaded');
  }

  async loadFilters() {
    try {
      const filtersRes = await api.getFilters();
      if (filtersRes.ready === false) {
        toast.info('Dataset index is warming up in memory...');
      }

      const filterData = filtersRes.data || {
        stores: ['S001', 'S002', 'S003', 'S004', 'S005'],
        products: Array.from({ length: 20 }, (_, i) => `P${String(i + 1).padStart(4, '0')}`),
        categories: ['Clothing', 'Electronics', 'Furniture', 'Groceries', 'Toys'],
        regions: ['East', 'North', 'South', 'West'],
        weathers: ['Cloudy', 'Rainy', 'Snowy', 'Sunny'],
        seasonalities: ['Autumn', 'Spring', 'Summer', 'Winter']
      };

      filtersController.init(filterData);
      this.populateAuxiliarySelectors(filterData);
    } catch (err) {
      console.warn('[App Init Filters Fallback]:', err.message);
    }
  }

  async loadTab(tabName) {
    if (this.loadedTabs.has(tabName) && tabName !== 'analytics' && tabName !== 'explorer') return;
    this.loadedTabs.add(tabName);

    try {
      switch(tabName) {
        case 'analytics':
          await analyticsTab.load();
          break;
        case 'wavelet':
          await waveletTab.load();
          break;
        case 'simulator':
          await simulatorTab.runSimulation();
          break;
        case 'governance':
          await governanceTab.load();
          break;
        case 'explorer':
          await explorerTab.load();
          break;
      }
    } catch (err) {
      console.error(`[Load Tab ${tabName} Error]:`, err);
    }
  }

  setupNavigation() {
    // Rail buttons
    document.querySelectorAll('.rail-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        state.setTab(tab);
      });
    });

    // Theme toggle button
    document.getElementById('btn-toggle-theme')?.addEventListener('click', () => {
      const next = theme.toggle();
      toast.info(`Theme set to ${next.toUpperCase()}`);
    });
  }

  switchTabUI(tabName) {
    document.querySelectorAll('.rail-item').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `tab-${tabName}`);
    });

    // Update Topbar page title & breadcrumbs
    const titleMap = {
      analytics: 'Demand Analytics & KPIs',
      wavelet: 'Wavelet Decomposition Lab',
      simulator: 'Scenario Simulator',
      governance: 'Model Governance',
      explorer: 'Data Explorer'
    };

    const titleEl = document.getElementById('topbar-page-title');
    if (titleEl) titleEl.textContent = titleMap[tabName] || 'Dashboard';

    const breadcrumbEl = document.getElementById('topbar-breadcrumb');
    if (breadcrumbEl) breadcrumbEl.textContent = `Platform / ${titleMap[tabName] || tabName}`;

    // Trigger chart resize after tab display
    window.dispatchEvent(new Event('resize'));
  }

  setupStatusPill() {
    const pill = document.getElementById('status-pill-trigger');
    const popover = document.getElementById('status-popover-box');

    if (pill && popover) {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        popover.classList.toggle('open');
      });

      document.addEventListener('click', (e) => {
        if (!popover.contains(e.target)) {
          popover.classList.remove('open');
        }
      });
    }
  }

  async pollStatus() {
    const dot = document.getElementById('status-dot-indicator');
    const label = document.getElementById('status-text-label');
    const popModel = document.getElementById('pop-model-version');
    const popStatus = document.getElementById('pop-server-status');
    const popLatency = document.getElementById('pop-latency-val');

    try {
      const status = await api.pingStatus();

      if (status.ready) {
        if (dot) dot.className = 'status-dot';
        if (label) label.textContent = 'Connected • Ready';
        if (popStatus) popStatus.textContent = 'Online';
        if (popLatency) popLatency.textContent = `${status.latency} ms`;
        if (popModel) popModel.textContent = 'Dual-RF db4 (v1.0)';
      } else if (status.warming) {
        if (dot) dot.className = 'status-dot warming';
        if (label) label.textContent = 'Warming Up...';
        if (popStatus) popStatus.textContent = 'Indexing dataset';
        if (popLatency) popLatency.textContent = `${status.latency || '--'} ms`;
      } else {
        if (dot) dot.className = 'status-dot offline';
        if (label) label.textContent = 'Offline / Error';
        if (popStatus) popStatus.textContent = 'Unreachable';
      }
    } catch (err) {
      if (dot) dot.className = 'status-dot offline';
      if (label) label.textContent = 'Service Offline';
    }
  }

  populateAuxiliarySelectors(filterData) {
    const { stores = [], products = [] } = filterData;

    const fill = (id, items) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = items.map(item => `<option value="${item}">${item}</option>`).join('');
    };

    fill('wavelet-store-select', stores);
    fill('wavelet-product-select', products);
    fill('sim-select-store', stores);
    fill('sim-select-product', products);
  }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  const app = new AppBootstrap();
  app.init();
});
