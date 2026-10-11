/**
 * Wavelet Retail AI — Command Palette (Ctrl/Cmd + K)
 * Keyboard-first navigation modal for jumping tabs, toggling themes, and applying presets
 */

import { state } from './state.js';
import { theme } from './theme.js';
import { toast } from './toast.js';

class CommandPalette {
  constructor() {
    this.modal = null;
    this.input = null;
    this.list = null;
    this.isOpen = false;
    this.commands = [
      { id: 'tab-analytics', title: 'Go to Demand Analytics & KPIs', group: 'Navigation', icon: 'fa-chart-line', action: () => state.setTab('analytics') },
      { id: 'tab-wavelet', title: 'Go to Wavelet Decomposition Lab', group: 'Navigation', icon: 'fa-wave-square', action: () => state.setTab('wavelet') },
      { id: 'tab-simulator', title: 'Go to Scenario Simulator', group: 'Navigation', icon: 'fa-wand-magic-sparkles', action: () => state.setTab('simulator') },
      { id: 'tab-governance', title: 'Go to Model Governance', group: 'Navigation', icon: 'fa-brain', action: () => state.setTab('governance') },
      { id: 'tab-explorer', title: 'Go to Data Explorer', group: 'Navigation', icon: 'fa-table-list', action: () => state.setTab('explorer') },
      { id: 'theme-toggle', title: 'Toggle Theme (Ink ↔ Paper)', group: 'Appearance', icon: 'fa-circle-half-stroke', action: () => { const next = theme.toggle(); toast.info(`Theme changed to ${next.toUpperCase()}`); } },
      { id: 'filters-reset', title: 'Reset All Dimension Filters', group: 'Actions', icon: 'fa-rotate-left', action: () => state.resetFilters() },
      { id: 'export-csv', title: 'Export Filtered Data as CSV', group: 'Export', icon: 'fa-download', action: () => document.getElementById('btn-export-csv-table')?.click() }
    ];
  }

  init() {
    this.modal = document.getElementById('cmd-palette-backdrop');
    this.input = document.getElementById('cmd-search-input');
    this.list = document.getElementById('cmd-list-container');

    if (!this.modal) return;

    // Open shortcut
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.toggle();
      } else if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Topbar trigger button
    document.getElementById('btn-open-cmd-palette')?.addEventListener('click', () => {
      this.open();
    });

    // Close on backdrop click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    // Filter commands on search input
    this.input?.addEventListener('input', (e) => {
      this.renderList(e.target.value.toLowerCase().trim());
    });
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    this.isOpen = true;
    this.modal.classList.add('open');
    this.input.value = '';
    this.renderList('');
    setTimeout(() => this.input.focus(), 50);
  }

  close() {
    this.isOpen = false;
    this.modal.classList.remove('open');
  }

  renderList(query = '') {
    const filtered = query
      ? this.commands.filter(c => c.title.toLowerCase().includes(query) || c.group.toLowerCase().includes(query))
      : this.commands;

    if (filtered.length === 0) {
      this.list.innerHTML = `<div style="padding:1.5rem; text-align:center; color:var(--text-muted); font-size:0.85rem;">No matching commands found</div>`;
      return;
    }

    // Group by category
    const groups = {};
    filtered.forEach(c => {
      if (!groups[c.group]) groups[c.group] = [];
      groups[c.group].push(c);
    });

    let html = '';
    for (const [groupName, items] of Object.entries(groups)) {
      html += `<div class="cmd-group-title">${groupName}</div>`;
      items.forEach(item => {
        html += `
          <div class="cmd-item" data-id="${item.id}">
            <div style="display:flex; align-items:center; gap:0.65rem;">
              <i class="fa-solid ${item.icon}" style="width:16px; color:var(--accent-primary);"></i>
              <span>${item.title}</span>
            </div>
            <i class="fa-solid fa-arrow-turn-down" style="font-size:0.7rem; color:var(--text-muted);"></i>
          </div>
        `;
      });
    }

    this.list.innerHTML = html;

    // Bind clicks
    this.list.querySelectorAll('.cmd-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        const cmd = this.commands.find(c => c.id === id);
        if (cmd) {
          cmd.action();
          this.close();
        }
      });
    });
  }
}

export const commandPalette = new CommandPalette();
