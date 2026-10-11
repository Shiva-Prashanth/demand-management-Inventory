/**
 * Wavelet Retail AI — Accessible Custom Combobox
 * Features searchable dropdown, keyboard navigation, multi-select and clean ARIA
 */

export class Combobox {
  constructor({ containerId, label, options = [], selected = 'ALL', onChange }) {
    this.container = document.getElementById(containerId);
    this.label = label;
    this.options = options;
    this.selected = selected; // 'ALL' or array / string
    this.onChange = onChange;
    this.isOpen = false;
    this.focusedIndex = -1;
    this.filteredOptions = [...options];

    if (this.container) {
      this.render();
      this.bindEvents();
    }
  }

  setOptions(newOptions, defaultSelected = 'ALL') {
    this.options = newOptions;
    this.filteredOptions = [...newOptions];
    this.selected = defaultSelected;
    this.render();
    this.bindEvents();
  }

  setSelected(val) {
    this.selected = val;
    this.updateTriggerText();
    this.updateListSelection();
  }

  render() {
    this.container.className = 'combobox';
    this.container.innerHTML = `
      <button type="button" class="combobox-trigger" aria-haspopup="listbox" aria-expanded="false" id="${this.container.id}-trigger">
        <span class="trigger-text">${this.getDisplayText()}</span>
        <i class="fa-solid fa-chevron-down caret"></i>
      </button>
      <div class="combobox-dropdown" role="listbox" id="${this.container.id}-listbox">
        <input type="text" class="combobox-search" placeholder="Search ${this.label}..." aria-label="Search ${this.label}">
        <div class="combobox-actions">
          <button type="button" class="btn-select-all">All</button>
          <button type="button" class="btn-clear-selection">Clear</button>
        </div>
        <div class="combobox-list">
          ${this.renderOptionsHTML()}
        </div>
      </div>
    `;
  }

  getDisplayText() {
    if (this.selected === 'ALL' || !this.selected) {
      return `All ${this.label}`;
    }
    return this.selected;
  }

  renderOptionsHTML() {
    let html = `
      <div class="combobox-item ${this.selected === 'ALL' ? 'selected' : ''}" data-value="ALL" role="option" aria-selected="${this.selected === 'ALL'}">
        <span>All ${this.label}</span>
      </div>
    `;

    this.filteredOptions.forEach((opt, idx) => {
      const isSel = this.selected === opt;
      html += `
        <div class="combobox-item ${isSel ? 'selected' : ''}" data-value="${opt}" role="option" aria-selected="${isSel}">
          <span>${opt}</span>
        </div>
      `;
    });
    return html;
  }

  bindEvents() {
    this.trigger = this.container.querySelector('.combobox-trigger');
    this.dropdown = this.container.querySelector('.combobox-dropdown');
    this.searchInput = this.container.querySelector('.combobox-search');
    this.listContainer = this.container.querySelector('.combobox-list');

    this.trigger.addEventListener('click', () => this.toggle());

    // Search filter
    this.searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      this.filteredOptions = this.options.filter(o => o.toLowerCase().includes(q));
      this.listContainer.innerHTML = this.renderOptionsHTML();
      this.bindItemClicks();
    });

    // "All" / "Clear" buttons
    this.container.querySelector('.btn-select-all').addEventListener('click', () => {
      this.selectOption('ALL');
    });
    this.container.querySelector('.btn-clear-selection').addEventListener('click', () => {
      this.selectOption('ALL');
    });

    this.bindItemClicks();

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        this.close();
      }
    });

    // Keyboard support
    this.container.addEventListener('keydown', (e) => this.handleKeyDown(e));
  }

  bindItemClicks() {
    this.listContainer.querySelectorAll('.combobox-item').forEach(item => {
      item.addEventListener('click', () => {
        const val = item.getAttribute('data-value');
        this.selectOption(val);
      });
    });
  }

  selectOption(val) {
    this.selected = val;
    this.updateTriggerText();
    this.updateListSelection();
    this.close();
    if (this.onChange) {
      this.onChange(this.selected);
    }
  }

  updateTriggerText() {
    const textEl = this.trigger.querySelector('.trigger-text');
    if (textEl) {
      textEl.textContent = this.getDisplayText();
    }
  }

  updateListSelection() {
    this.listContainer.querySelectorAll('.combobox-item').forEach(item => {
      const val = item.getAttribute('data-value');
      const isSel = this.selected === val;
      item.classList.toggle('selected', isSel);
      item.setAttribute('aria-selected', isSel);
    });
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    this.isOpen = true;
    this.container.classList.add('open');
    this.trigger.setAttribute('aria-expanded', 'true');
    this.searchInput.value = '';
    this.filteredOptions = [...this.options];
    this.listContainer.innerHTML = this.renderOptionsHTML();
    this.bindItemClicks();
    setTimeout(() => this.searchInput.focus(), 50);
  }

  close() {
    this.isOpen = false;
    this.container.classList.remove('open');
    this.trigger.setAttribute('aria-expanded', 'false');
  }

  handleKeyDown(e) {
    if (!this.isOpen && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault();
      this.open();
      return;
    }

    if (e.key === 'Escape') {
      this.close();
      this.trigger.focus();
    }
  }
}
