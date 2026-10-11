/**
 * Wavelet Retail AI — Data Explorer Tab Controller
 * Virtualized paginated table with column sorting, density toggle and CSV export
 */

import { api } from '../api.js';
import { state } from '../state.js';
import { toast } from '../toast.js';

class ExplorerTab {
  constructor() {
    this.tableState = {
      page: 1,
      limit: 15,
      search: '',
      sortBy: 'date',
      sortOrder: 'desc',
      density: 'comfortable',
      totalPages: 1
    };
  }

  async load() {
    const filters = state.get('filters');
    const tbody = document.getElementById('explorer-table-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:2rem; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading records...</td></tr>`;
    }

    try {
      const res = await api.getRawData({
        page: this.tableState.page,
        limit: this.tableState.limit,
        search: this.tableState.search,
        sortBy: this.tableState.sortBy,
        sortOrder: this.tableState.sortOrder,
        storeId: filters.storeId,
        productId: filters.productId,
        category: filters.category,
        region: filters.region
      });

      if (res.success) {
        this.tableState.totalPages = res.totalPages || 1;
        this.renderRows(res.data || []);
        this.renderPagination(res.total || 0);
      }
    } catch (err) {
      console.error('[ExplorerTab Error]:', err);
      if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:2rem; color:var(--trend-down);">Error loading records: ${err.message}</td></tr>`;
    }
  }

  renderRows(rows) {
    const tbody = document.getElementById('explorer-table-tbody');
    if (!tbody) return;

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:2rem; color:var(--text-muted);">No records match the current filter selection.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td class="mono">${r.date}</td>
        <td><strong style="color:var(--text-primary);">${r.storeId}</strong></td>
        <td><strong style="color:var(--accent-primary);">${r.productId}</strong></td>
        <td>${r.category}</td>
        <td>${r.region}</td>
        <td class="num">$${r.price.toFixed(2)}</td>
        <td class="num">${r.discount}%</td>
        <td><span class="mono" style="color:var(--accent-tertiary);">${r.weatherCondition}</span></td>
        <td><span class="mono">${r.seasonality}</span></td>
        <td class="num" style="font-weight:700; color:var(--accent-primary);">${Math.round(r.demand).toLocaleString()}</td>
      </tr>
    `).join('');
  }

  renderPagination(total) {
    const info = document.getElementById('explorer-page-info');
    const prevBtn = document.getElementById('btn-table-prev');
    const nextBtn = document.getElementById('btn-table-next');

    if (info) {
      info.textContent = `Page ${this.tableState.page} of ${this.tableState.totalPages} (${total.toLocaleString()} total rows)`;
    }
    if (prevBtn) prevBtn.disabled = this.tableState.page <= 1;
    if (nextBtn) nextBtn.disabled = this.tableState.page >= this.tableState.totalPages;
  }

  bindEvents() {
    // Search input
    let timer = null;
    document.getElementById('table-search-box')?.addEventListener('input', (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        this.tableState.search = e.target.value;
        this.tableState.page = 1;
        this.load();
      }, 300);
    });

    // Pagination buttons
    document.getElementById('btn-table-prev')?.addEventListener('click', () => {
      if (this.tableState.page > 1) {
        this.tableState.page--;
        this.load();
      }
    });

    document.getElementById('btn-table-next')?.addEventListener('click', () => {
      if (this.tableState.page < this.tableState.totalPages) {
        this.tableState.page++;
        this.load();
      }
    });

    // Density toggle
    document.getElementById('btn-toggle-density')?.addEventListener('click', () => {
      const table = document.getElementById('explorer-table');
      if (table) {
        table.classList.toggle('compact');
        const isCompact = table.classList.contains('compact');
        toast.info(`Table density: ${isCompact ? 'Compact' : 'Comfortable'}`);
      }
    });

    // CSV Export
    document.getElementById('btn-export-csv-table')?.addEventListener('click', () => {
      const filters = state.get('filters');
      toast.info('Preparing CSV export download...');
      window.open(`${api.baseUrl}/demand/raw?limit=10000&storeId=${filters.storeId}&category=${filters.category}`, '_blank');
    });

    // Column headers sorting
    document.querySelectorAll('.virtual-table th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const field = th.getAttribute('data-sort');
        if (this.tableState.sortBy === field) {
          this.tableState.sortOrder = this.tableState.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          this.tableState.sortBy = field;
          this.tableState.sortOrder = 'asc';
        }
        this.load();
      });
    });
  }
}

export const explorerTab = new ExplorerTab();
