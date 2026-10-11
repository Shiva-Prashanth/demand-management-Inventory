/**
 * Wavelet Retail AI — Custom Date Range Picker
 * Supports quick enterprise presets (7D, 30D, Month, Quarter, Full range) and custom bounds
 */

export class DateRangePicker {
  constructor({ containerId, onRangeChange }) {
    this.container = document.getElementById(containerId);
    this.onRangeChange = onRangeChange;
    this.activePreset = 'full';
    this.from = '';
    this.to = '';

    if (this.container) {
      this.render();
      this.bindEvents();
    }
  }

  render() {
    this.container.className = 'datepicker-wrap';
    this.container.innerHTML = `
      <button type="button" class="datepicker-trigger" id="datepicker-trigger-btn">
        <i class="fa-regular fa-calendar" style="color:var(--accent-tertiary);"></i>
        <span class="range-display-text">Full Range</span>
        <i class="fa-solid fa-chevron-down caret" style="font-size:0.7rem; color:var(--text-muted);"></i>
      </button>

      <div class="datepicker-dropdown" id="datepicker-dropdown-menu">
        <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-muted); font-weight:600;">
          Quick Presets
        </div>
        <div class="preset-pills-grid">
          <button type="button" class="preset-btn" data-preset="7d">Last 7 Days</button>
          <button type="button" class="preset-btn" data-preset="30d">Last 30 Days</button>
          <button type="button" class="preset-btn" data-preset="month">This Month</button>
          <button type="button" class="preset-btn" data-preset="quarter">Last Quarter</button>
          <button type="button" class="preset-btn active" data-preset="full">Full Range</button>
        </div>

        <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-muted); font-weight:600; margin-top:0.35rem;">
          Custom Interval
        </div>
        <div class="date-inputs-row">
          <input type="date" id="dp-input-from" placeholder="From" aria-label="Start date">
          <input type="date" id="dp-input-to" placeholder="To" aria-label="End date">
        </div>
        <button type="button" class="btn-primary" id="btn-apply-custom-date" style="padding:0.4rem; font-size:0.78rem; justify-content:center;">
          Apply Interval
        </button>
      </div>
    `;
  }

  bindEvents() {
    this.trigger = this.container.querySelector('.datepicker-trigger');
    this.dropdown = this.container.querySelector('.datepicker-dropdown');
    this.fromInput = this.container.querySelector('#dp-input-from');
    this.toInput = this.container.querySelector('#dp-input-to');
    this.rangeText = this.container.querySelector('.range-display-text');

    this.trigger.addEventListener('click', () => {
      this.container.classList.toggle('open');
    });

    // Preset buttons
    this.container.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-preset');
        this.selectPreset(preset);
      });
    });

    // Apply custom interval button
    this.container.querySelector('#btn-apply-custom-date').addEventListener('click', () => {
      this.from = this.fromInput.value;
      this.to = this.toInput.value;
      this.activePreset = 'custom';
      this.updateDisplay();
      this.container.classList.remove('open');
      if (this.onRangeChange) this.onRangeChange(this.from, this.to, 'custom');
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        this.container.classList.remove('open');
      }
    });
  }

  selectPreset(preset) {
    this.activePreset = preset;
    this.container.querySelectorAll('.preset-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-preset') === preset);
    });

    const maxDate = new Date('2024-01-30'); // Dataset max coverage
    let fromDate = null;
    let toDate = maxDate.toISOString().slice(0, 10);

    if (preset === '7d') {
      const d = new Date(maxDate);
      d.setDate(d.getDate() - 7);
      fromDate = d.toISOString().slice(0, 10);
    } else if (preset === '30d') {
      const d = new Date(maxDate);
      d.setDate(d.getDate() - 30);
      fromDate = d.toISOString().slice(0, 10);
    } else if (preset === 'month') {
      fromDate = '2024-01-01';
      toDate = '2024-01-30';
    } else if (preset === 'quarter') {
      fromDate = '2023-10-01';
      toDate = '2023-12-31';
    } else if (preset === 'full') {
      fromDate = '';
      toDate = '';
    }

    this.from = fromDate || '';
    this.to = toDate || '';
    this.fromInput.value = this.from;
    this.toInput.value = this.to;

    this.updateDisplay();
    this.container.classList.remove('open');

    if (this.onRangeChange) {
      this.onRangeChange(this.from, this.to, preset);
    }
  }

  reset() {
    this.selectPreset('full');
  }

  updateDisplay() {
    if (this.activePreset === 'full' || (!this.from && !this.to)) {
      this.rangeText.textContent = 'Full Range (2022-2024)';
    } else if (this.activePreset === '7d') {
      this.rangeText.textContent = 'Last 7 Days';
    } else if (this.activePreset === '30d') {
      this.rangeText.textContent = 'Last 30 Days';
    } else if (this.activePreset === 'month') {
      this.rangeText.textContent = 'Jan 2024';
    } else if (this.activePreset === 'quarter') {
      this.rangeText.textContent = 'Q4 2023';
    } else {
      this.rangeText.textContent = `${this.from || 'Start'} → ${this.to || 'End'}`;
    }
  }
}
