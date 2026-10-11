/**
 * Wavelet Retail AI — Filter Bar Controller
 * Orchestrates comboboxes, date presets, active chips and mobile drawer
 */

import { state } from './state.js';
import { Combobox } from './combobox.js';
import { DateRangePicker } from './datepicker.js';
import { toast } from './toast.js';

class FiltersController {
  constructor() {
    this.comboboxes = {};
    this.datePicker = null;
  }

  init(filterData) {
    const { stores = [], products = [], categories = [], regions = [], weathers = [], seasonalities = [] } = filterData || {};

    // 1. Initialize Comboboxes
    this.comboboxes.store = new Combobox({
      containerId: 'cb-store',
      label: 'Store',
      options: stores,
      selected: 'ALL',
      onChange: (val) => state.setFilter('storeId', val)
    });

    this.comboboxes.product = new Combobox({
      containerId: 'cb-product',
      label: 'Product',
      options: products,
      selected: 'ALL',
      onChange: (val) => state.setFilter('productId', val)
    });

    this.comboboxes.category = new Combobox({
      containerId: 'cb-category',
      label: 'Category',
      options: categories,
      selected: 'ALL',
      onChange: (val) => state.setFilter('category', val)
    });

    this.comboboxes.region = new Combobox({
      containerId: 'cb-region',
      label: 'Region',
      options: regions,
      selected: 'ALL',
      onChange: (val) => state.setFilter('region', val)
    });

    // Default strictly to "All Weather" and "All Seasons"
    this.comboboxes.weather = new Combobox({
      containerId: 'cb-weather',
      label: 'Weather',
      options: weathers,
      selected: 'ALL',
      onChange: (val) => state.setFilter('weather', val)
    });

    this.comboboxes.seasonality = new Combobox({
      containerId: 'cb-seasonality',
      label: 'Season',
      options: seasonalities,
      selected: 'ALL',
      onChange: (val) => state.setFilter('seasonality', val)
    });

    // 2. Date Range Picker
    this.datePicker = new DateRangePicker({
      containerId: 'dp-range-wrapper',
      onRangeChange: (from, to, preset) => {
        state.setFilter('from', from);
        state.setFilter('to', to);
      }
    });

    // 3. Reset Button
    const resetBtn = document.getElementById('btn-reset-all-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetAll();
        toast.info('All filters reset to defaults.');
      });
    }

    // 4. Mobile Drawer Toggle (<900px)
    const drawerBtn = document.getElementById('btn-toggle-filters-drawer');
    const controlsRow = document.querySelector('.filter-controls-row');
    if (drawerBtn && controlsRow) {
      drawerBtn.addEventListener('click', () => {
        controlsRow.classList.toggle('drawer-open');
      });
    }

    // Subscribe to state changes to update chips
    state.on('filter:change', () => this.renderActiveChips());
    state.on('filter:reset', () => this.syncComboboxes());
    this.renderActiveChips();
  }

  resetAll() {
    this.syncComboboxes();
    if (this.datePicker) this.datePicker.reset();
    state.resetFilters();
  }

  syncComboboxes() {
    Object.values(this.comboboxes).forEach(cb => cb.setSelected('ALL'));
  }

  renderActiveChips() {
    const chipsContainer = document.getElementById('filter-chips-container');
    const badgeEl = document.getElementById('active-filters-count-badge');
    if (!chipsContainer) return;

    const filters = state.get('filters');
    const activeList = [];

    if (filters.storeId && filters.storeId !== 'ALL') activeList.push({ key: 'storeId', label: `Store: ${filters.storeId}` });
    if (filters.productId && filters.productId !== 'ALL') activeList.push({ key: 'productId', label: `SKU: ${filters.productId}` });
    if (filters.category && filters.category !== 'ALL') activeList.push({ key: 'category', label: `Cat: ${filters.category}` });
    if (filters.region && filters.region !== 'ALL') activeList.push({ key: 'region', label: `Region: ${filters.region}` });
    if (filters.weather && filters.weather !== 'ALL') activeList.push({ key: 'weather', label: `Weather: ${filters.weather}` });
    if (filters.seasonality && filters.seasonality !== 'ALL') activeList.push({ key: 'seasonality', label: `Season: ${filters.seasonality}` });
    if (filters.from || filters.to) activeList.push({ key: 'date', label: `Dates: ${filters.from || 'Min'} → ${filters.to || 'Max'}` });

    if (badgeEl) {
      badgeEl.textContent = activeList.length > 0 ? `${activeList.length} Active` : '';
      badgeEl.style.display = activeList.length > 0 ? 'inline-block' : 'none';
    }

    if (activeList.length === 0) {
      chipsContainer.innerHTML = `<span style="font-size:0.72rem; color:var(--text-muted);">No active dimension filters (full dataset)</span>`;
      return;
    }

    chipsContainer.innerHTML = activeList.map(item => `
      <span class="filter-chip" data-key="${item.key}">
        <span>${item.label}</span>
        <i class="fa-solid fa-xmark remove-chip" title="Remove filter"></i>
      </span>
    `).join('') + `
      <button type="button" class="btn-reset-filters" id="btn-chip-clear-all">Clear All</button>
    `;

    // Bind chip removals
    chipsContainer.querySelectorAll('.filter-chip').forEach(chip => {
      chip.querySelector('.remove-chip').addEventListener('click', () => {
        const key = chip.getAttribute('data-key');
        if (key === 'date') {
          if (this.datePicker) this.datePicker.reset();
          state.setFilter('from', '');
          state.setFilter('to', '');
        } else {
          const map = { storeId: 'store', productId: 'product', category: 'category', region: 'region', weather: 'weather', seasonality: 'seasonality' };
          if (this.comboboxes[map[key]]) this.comboboxes[map[key]].setSelected('ALL');
          state.setFilter(key, 'ALL');
        }
      });
    });

    const clearAllBtn = chipsContainer.querySelector('#btn-chip-clear-all');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => this.resetAll());
    }
  }
}

export const filtersController = new FiltersController();
