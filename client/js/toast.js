/**
 * Wavelet Retail AI — Toast Notification System
 */

class ToastManager {
  constructor() {
    this.shelf = null;
  }

  ensureShelf() {
    if (!this.shelf) {
      this.shelf = document.getElementById('toast-shelf');
      if (!this.shelf) {
        this.shelf = document.createElement('div');
        this.shelf.id = 'toast-shelf';
        this.shelf.className = 'toast-shelf';
        document.body.appendChild(this.shelf);
      }
    }
  }

  show(message, icon = 'fa-circle-info') {
    this.ensureShelf();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    this.shelf.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  success(msg) {
    this.show(msg, 'fa-check');
  }

  error(msg) {
    this.show(msg, 'fa-triangle-exclamation');
  }

  info(msg) {
    this.show(msg, 'fa-circle-info');
  }
}

export const toast = new ToastManager();
