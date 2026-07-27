// State management
let urls = [];

// DOM Elements
const form = document.getElementById('shortener-form');
const longUrlInput = document.getElementById('long-url');
const customAliasInput = document.getElementById('custom-alias');
const expiresAtInput = document.getElementById('expires-at');
const searchInput = document.getElementById('search-input');
const emptyState = document.getElementById('empty-state');
const urlsListContainer = document.getElementById('urls-list');

// Stats DOM
const statTotalLinks = document.getElementById('stat-total-links');
const statTotalClicks = document.getElementById('stat-total-clicks');
const statActiveLinks = document.getElementById('stat-active-links');

// Modal DOM
const qrModal = document.getElementById('qr-modal');
const qrImage = document.getElementById('qr-image');
const qrTargetUrl = document.getElementById('qr-target-url');
const modalClose = document.getElementById('modal-close');
const btnDownloadQr = document.getElementById('btn-download-qr');

// Toast DOM
const toast = document.getElementById('toast');
const toastIcon = document.getElementById('toast-icon');
const toastMessage = document.getElementById('toast-message');

let currentQrCodeUrl = '';

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  fetchUrls();
  setupEventListeners();
  
  // Set minimum date for expiry picker to current date-time
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  expiresAtInput.min = now.toISOString().slice(0, 16);
});

// Setup event handlers
function setupEventListeners() {
  // Form submission
  form.addEventListener('submit', handleFormSubmit);

  // Search input typing
  searchInput.addEventListener('input', handleSearch);

  // Close modal click
  modalClose.addEventListener('click', closeQrModal);
  
  // Close modal when clicking outside contents
  qrModal.addEventListener('click', (e) => {
    if (e.target === qrModal) {
      closeQrModal();
    }
  });

  // Download QR click
  btnDownloadQr.addEventListener('click', downloadQrCode);
}

// Fetch all URLs from Express API
async function fetchUrls() {
  try {
    const response = await fetch('/api/urls');
    if (!response.ok) throw new Error('Failed to load shortened links.');
    urls = await response.ok ? await response.json() : [];
    renderDashboard();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Handle shortening form submission
async function handleFormSubmit(e) {
  e.preventDefault();
  
  const submitButton = document.getElementById('btn-submit');
  const originalBtnContent = submitButton.innerHTML;
  
  // Disable button & show loading state
  submitButton.disabled = true;
  submitButton.innerHTML = '<span>Processing...</span><span class="status-dot animate-pulse"></span>';

  const longUrl = longUrlInput.value.trim();
  const customAlias = customAliasInput.value.trim();
  const expiresAt = expiresAtInput.value;

  try {
    const response = await fetch('/api/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ longUrl, customAlias, expiresAt })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Something went wrong.');
    }

    // Success!
    showToast('URL shortened successfully!', 'success');
    form.reset();
    
    // Refresh lists
    await fetchUrls();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = originalBtnContent;
    lucide.createIcons();
  }
}

// Search and filter links
function handleSearch() {
  renderUrlsList(searchInput.value.trim());
}

// Update dashboard view (stats + lists)
function renderDashboard() {
  renderStats();
  renderUrlsList(searchInput.value.trim());
}

// Calculate and render global stats
function renderStats() {
  const total = urls.length;
  const clicks = urls.reduce((acc, u) => acc + u.clicks, 0);
  const active = urls.filter(u => {
    const isExpired = u.expiresAt ? new Date(u.expiresAt) < new Date() : false;
    return u.isActive && !isExpired;
  }).length;

  statTotalLinks.textContent = total;
  statTotalClicks.textContent = clicks;
  statActiveLinks.textContent = active;
}

// Render the list of URLs based on search filter
function renderUrlsList(filterQuery = '') {
  const filtered = urls.filter(u => {
    const query = filterQuery.toLowerCase();
    const matchesLong = u.longUrl.toLowerCase().includes(query);
    const matchesShort = u.code.toLowerCase().includes(query);
    return matchesLong || matchesShort;
  });

  if (filtered.length === 0) {
    emptyState.style.display = 'flex';
    urlsListContainer.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  urlsListContainer.style.display = 'flex';
  urlsListContainer.innerHTML = '';

  filtered.forEach(url => {
    const shortUrl = `${window.location.origin}/${url.code}`;
    const isExpired = url.expiresAt ? new Date(url.expiresAt) < new Date() : false;
    
    // Status Badge determination
    let statusBadgeHtml = '';
    if (!url.isActive) {
      statusBadgeHtml = `<span class="badge badge-inactive"><i data-lucide="slash"></i>Inactive</span>`;
    } else if (isExpired) {
      statusBadgeHtml = `<span class="badge badge-expiry"><i data-lucide="clock-alert"></i>Expired</span>`;
    } else {
      statusBadgeHtml = `<span class="badge badge-active"><i data-lucide="check"></i>Active</span>`;
    }

    // Expiry badge helper
    let expiryInfoHtml = '';
    if (url.expiresAt && !isExpired) {
      const expDate = new Date(url.expiresAt).toLocaleDateString();
      const expTime = new Date(url.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      expiryInfoHtml = `
        <span class="badge badge-expiry" title="Expires at ${expDate} ${expTime}">
          <i data-lucide="calendar-clock"></i> Exp: ${expDate}
        </span>
      `;
    }

    const card = document.createElement('div');
    card.className = `url-item ${!url.isActive || isExpired ? 'deactivated' : ''}`;
    card.innerHTML = `
      <div class="url-main-row">
        <div class="url-badge-icon">
          <i data-lucide="${url.customAlias ? 'sparkles' : 'link-2'}"></i>
        </div>
        
        <div class="url-details">
          <div class="short-url-row">
            <a href="${shortUrl}" target="_blank" class="short-url-link">${window.location.host}/${url.code}</a>
            <button class="btn-copy" onclick="copyToClipboard('${shortUrl}', this)" title="Copy short link">
              <i data-lucide="copy" class="copy-icon-symbol"></i>
            </button>
          </div>
          <div class="long-url-text" title="${url.longUrl}">${url.longUrl}</div>
        </div>

        <div class="url-badges">
          ${statusBadgeHtml}
          ${expiryInfoHtml}
          <span class="badge badge-clicks"><i data-lucide="bar-chart-2"></i> ${url.clicks} clicks</span>
        </div>

        <div class="url-actions">
          <button class="btn-action btn-action-analytics" onclick="toggleAnalyticsDrawer('${url.code}')" title="View Click History">
            <i data-lucide="eye"></i>
          </button>
          <button class="btn-action" onclick="showQrModal('${shortUrl}')" title="Generate QR Code">
            <i data-lucide="qr-code"></i>
          </button>
          <label class="switch" title="Toggle active/inactive status">
            <input type="checkbox" ${url.isActive ? 'checked' : ''} onchange="toggleUrlStatus('${url.code}')" ${isExpired ? 'disabled' : ''}>
            <span class="slider"></span>
          </label>
          <button class="btn-action btn-action-delete" onclick="deleteUrl('${url.code}')" title="Delete Short Link">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>

      <!-- Expandable Analytics Drawer -->
      <div id="analytics-${url.code}" class="analytics-drawer">
        <div class="analytics-content">
          <h4>
            <i data-lucide="activity"></i>
            <span>Detailed Analytics logs (Last 5 Clicks)</span>
          </h4>
          <div class="clicks-table-wrapper">
            <table class="clicks-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>IP Address</th>
                  <th>User Agent</th>
                </tr>
              </thead>
              <tbody>
                ${renderClicksHistory(url.clicksHistory)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    urlsListContainer.appendChild(card);
  });

  // Re-run Lucide icons initializer for dynamically appended elements
  lucide.createIcons();
}

// Render clicks history logs table body
function renderClicksHistory(history = []) {
  if (!history || history.length === 0) {
    return `
      <tr>
        <td colspan="3" style="text-align: center; color: var(--text-dimmed); padding: 20px;">
          No click events recorded for this URL yet.
        </td>
      </tr>
    `;
  }

  // Get last 5 click logs (reversed order)
  const recentLogs = [...history].slice(-5).reverse();
  
  return recentLogs.map(click => {
    const clickTime = new Date(click.timestamp).toLocaleString();
    return `
      <tr>
        <td>${clickTime}</td>
        <td class="click-ip">${click.ip}</td>
        <td class="click-ua" title="${click.userAgent}">${click.userAgent}</td>
      </tr>
    `;
  }).join('');
}

// Copy URL link to clipboard
function copyToClipboard(text, buttonElement) {
  navigator.clipboard.writeText(text).then(() => {
    // Modify icon temporarily
    buttonElement.classList.add('copied');
    const icon = buttonElement.querySelector('.copy-icon-symbol');
    
    // Save original lucide icon name attribute
    icon.setAttribute('data-lucide', 'check');
    lucide.createIcons();
    
    showToast('Copied to clipboard!', 'success');

    setTimeout(() => {
      buttonElement.classList.remove('copied');
      icon.setAttribute('data-lucide', 'copy');
      lucide.createIcons();
    }, 2000);
  }).catch(() => {
    showToast('Failed to copy to clipboard.', 'error');
  });
}

// Toggle active/inactive status API
async function toggleUrlStatus(code) {
  try {
    const response = await fetch(`/api/urls/${code}/toggle`, {
      method: 'PATCH'
    });
    
    if (!response.ok) {
      throw new Error('Failed to toggle link status.');
    }

    const data = await response.json();
    showToast(`Link status updated to ${data.isActive ? 'Active' : 'Inactive'}`, 'info');
    
    // Refresh stats and state
    await fetchUrls();
  } catch (error) {
    showToast(error.message, 'error');
    fetchUrls(); // Refresh state anyway to revert toggle check state
  }
}

// Delete link API
async function deleteUrl(code) {
  if (!confirm('Are you sure you want to delete this shortened link?')) return;

  try {
    const response = await fetch(`/api/urls/${code}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Failed to delete URL.');
    }

    showToast('URL successfully deleted.', 'success');
    await fetchUrls();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Expand or collapse analytics details drawer
function toggleAnalyticsDrawer(code) {
  const drawer = document.getElementById(`analytics-${code}`);
  const isCurrentlyOpen = drawer.classList.contains('open');
  
  // Close all other open drawers first
  document.querySelectorAll('.analytics-drawer').forEach(d => {
    d.classList.remove('open');
  });

  // Toggle this one
  if (!isCurrentlyOpen) {
    drawer.classList.add('open');
  }
}

// Show QR Code dialog Modal
function showQrModal(url) {
  currentQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
  qrImage.src = currentQrCodeUrl;
  qrTargetUrl.textContent = url;
  
  qrModal.classList.add('show');
}

// Close QR Code dialog Modal
function closeQrModal() {
  qrModal.classList.remove('show');
}

// Download generated QR Code image locally
async function downloadQrCode() {
  if (!currentQrCodeUrl) return;

  const originalContent = btnDownloadQr.innerHTML;
  btnDownloadQr.disabled = true;
  btnDownloadQr.innerHTML = '<i data-lucide="loader" class="animate-spin"></i><span>Fetching image...</span>';
  lucide.createIcons();

  try {
    const response = await fetch(currentQrCodeUrl);
    if (!response.ok) throw new Error('CORS error fetching QR Code image.');
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    // Create hidden anchor element to trigger download
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `swiftlink-qr-${Math.random().toString(36).substring(7)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
    
    showToast('QR Code download started.', 'success');
  } catch (error) {
    // Fallback: Open in new tab if CORS prevents direct download block
    window.open(currentQrCodeUrl, '_blank');
    showToast('QR Code opened in new tab for saving.', 'info');
  } finally {
    btnDownloadQr.disabled = false;
    btnDownloadQr.innerHTML = originalContent;
    lucide.createIcons();
  }
}

// Trigger sliding system toast notifications
function showToast(message, type = 'info') {
  // Clear any existing class modifiers
  toastIcon.className = '';
  toastIcon.classList.add(type);
  
  // Set Lucide icon type
  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle-2';
  if (type === 'error') iconName = 'alert-triangle';
  
  toastIcon.setAttribute('data-lucide', iconName);
  lucide.createIcons();
  
  toastMessage.textContent = message;
  toast.className = `toast show`; // Reset and show

  // Reset timer
  if (window.toastTimer) {
    clearTimeout(window.toastTimer);
  }

  window.toastTimer = setTimeout(() => {
    toast.className = 'toast';
  }, 3500);
}
