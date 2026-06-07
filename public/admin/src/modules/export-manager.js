// Export Manager - Reusable export modal component for admin pages

class ExportManager {
  constructor() {
    this.isOpen = false;
    this.currentExportType = null;
    this.userId = null;
  }

  init(userId) {
    this.userId = userId;
    this.createModal();
  }

  createModal() {
    const modalHTML = `
      <div id="export-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center" style="display: none;">
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
          <!-- Header -->
          <div class="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i class="fa-solid fa-download text-white text-lg"></i>
              <h2 class="text-xl font-bold text-white">Export Data</h2>
            </div>
            <button id="export-modal-close" class="text-white hover:text-blue-100 transition">
              <i class="fa-solid fa-times text-xl"></i>
            </button>
          </div>

          <!-- Body -->
          <div class="p-6">
            <!-- Format Selection -->
            <div class="mb-6">
              <label class="block text-sm font-semibold text-gray-700 mb-3">Format</label>
              <div class="flex gap-3">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="export-format" value="csv" checked class="w-4 h-4">
                  <span class="text-sm text-gray-700">CSV</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="export-format" value="json" class="w-4 h-4">
                  <span class="text-sm text-gray-700">JSON</span>
                </label>
              </div>
            </div>

            <!-- Date Range -->
            <div class="mb-6">
              <label class="block text-sm font-semibold text-gray-700 mb-3">Date Range</label>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-gray-600 mb-1">Start Date</label>
                  <input type="date" id="export-start-date" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                </div>
                <div>
                  <label class="block text-xs text-gray-600 mb-1">End Date</label>
                  <input type="date" id="export-end-date" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                </div>
              </div>
              <p class="text-xs text-gray-500 mt-2">Leave empty for all records</p>
            </div>

            <!-- Export Info -->
            <div id="export-info" class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 hidden">
              <p class="text-sm text-blue-700">
                <i class="fa-solid fa-info-circle mr-2"></i>
                <span id="export-info-text"></span>
              </p>
            </div>

            <!-- Status Message -->
            <div id="export-status" class="hidden mb-4 p-3 rounded-lg text-sm"></div>
          </div>

          <!-- Footer -->
          <div class="bg-gray-50 px-6 py-4 flex gap-3 justify-end border-t border-gray-200">
            <button id="export-modal-cancel" class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition font-medium text-sm">
              Cancel
            </button>
            <button id="export-modal-submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium text-sm flex items-center gap-2">
              <i class="fa-solid fa-download"></i>
              Export
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.attachEventListeners();
  }

  attachEventListeners() {
    const modal = document.getElementById('export-modal');
    const closeBtn = document.getElementById('export-modal-close');
    const cancelBtn = document.getElementById('export-modal-cancel');
    const submitBtn = document.getElementById('export-modal-submit');

    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());
    submitBtn.addEventListener('click', () => this.performExport());

    // Set default dates
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    document.getElementById('export-start-date').value = thirtyDaysAgo.toISOString().split('T')[0];
    document.getElementById('export-end-date').value = today.toISOString().split('T')[0];
  }

  open(exportType, exportLabel) {
    this.currentExportType = exportType;
    const modal = document.getElementById('export-modal');
    modal.style.display = 'flex';
    this.isOpen = true;

    // Update info text
    const infoElement = document.getElementById('export-info-text');
    infoElement.textContent = `Exporting ${exportLabel}. Your file will download automatically.`;
    document.getElementById('export-info').classList.remove('hidden');
  }

  close() {
    const modal = document.getElementById('export-modal');
    modal.style.display = 'none';
    this.isOpen = false;
    this.currentExportType = null;

    // Clear status message
    const statusElement = document.getElementById('export-status');
    statusElement.classList.add('hidden');
  }

  async performExport() {
    if (!this.currentExportType) return;

    const format = document.querySelector('input[name="export-format"]:checked').value;
    const startDate = document.getElementById('export-start-date').value;
    const endDate = document.getElementById('export-end-date').value;

    const submitBtn = document.getElementById('export-modal-submit');
    const statusElement = document.getElementById('export-status');

    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Exporting...';

    try {
      const response = await fetch(`/api/export/${this.currentExportType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: startDate || null,
          end_date: endDate || null,
          format,
          userId: this.userId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Export failed');
      }

      // Get filename from response headers
      const contentDisposition = response.headers.get('content-disposition');
      const filename = contentDisposition?.split('filename="')[1]?.split('"')[0] || `export-${this.currentExportType}.${format === 'json' ? 'json' : 'csv'}`;

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Show success message
      statusElement.className = 'bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-sm';
      statusElement.innerHTML = `<i class="fa-solid fa-check-circle mr-2"></i>Export successful! File: ${filename}`;
      statusElement.classList.remove('hidden');

      setTimeout(() => this.close(), 2000);
    } catch (error) {
      statusElement.className = 'bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm';
      statusElement.innerHTML = `<i class="fa-solid fa-exclamation-circle mr-2"></i>${error.message}`;
      statusElement.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-download"></i> Export';
    }
  }
}

// Create global instance + named export for direct imports
window.exportManager = new ExportManager();
export { ExportManager };
export default window.exportManager;
