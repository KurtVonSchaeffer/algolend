// Handles page switching
// Main Dashboard Script

document.addEventListener('DOMContentLoaded', async () => {
  // Load navbar and sidebar
  await loadNavbar();
  await loadSidebar();

  // Get initial page from URL or default to dashboard
  const initialPage = getPageFromURL() || 'dashboard';
  await loadPage(initialPage);

  // Setup navigation listeners
  setupNavigation();

  // Setup notification button
  setupNotificationButton();

  // Setup account button
  setupAccountButton();

  // Setup logout button
  setupLogout();
});

/**
 * Load navbar component
 */
async function loadNavbar() {
  try {
    const response = await fetch('/layouts/navbar.html');
    const html = await response.text();
    document.getElementById('navbar').innerHTML = html;
  } catch (error) {
    console.error('Error loading navbar:', error);
  }
}

/**
 * Load sidebar component
 */
async function loadSidebar() {
  try {
    const response = await fetch('/layouts/sidebar.html');
    const html = await response.text();
    document.getElementById('sidebar').innerHTML = html;
  } catch (error) {
    console.error('Error loading sidebar:', error);
  }
}

/**
 * Load page content dynamically
 */
async function loadPage(pageName) {
  try {
    showLoading(true);

    // Load HTML
    const htmlResponse = await fetch(`/pages/${pageName}.html`);
    if (!htmlResponse.ok) throw new Error(`Page not found: ${pageName}`);
    const htmlContent = await htmlResponse.text();


    // Load CSS with error handling
    try {
      const cssUrl = `/pages-css/${pageName}.css?t=${Date.now()}`;
      await fetchWithTimeout(cssUrl, 2000); // Try to fetch CSS, but don't block if missing
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssUrl;
      document.head.appendChild(link);
    } catch (e) {
      console.warn(`CSS for ${pageName} not found or timed out.`);
    }

    // Insert HTML into main content
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = htmlContent;
    mainContent.classList.add('fade-in');

    // Load JavaScript for the page with error handling
    try {
      const jsUrl = `/pages-js/${pageName}.js?t=${Date.now()}`;
      const scriptResponse = await fetchWithTimeout(jsUrl, 2000);
      if (scriptResponse.ok) {
        const scriptContent = await scriptResponse.text();
        const script = document.createElement('script');
        script.innerHTML = scriptContent;
        mainContent.appendChild(script);
      }
    } catch (e) {
      console.warn(`JS for ${pageName} not found or timed out.`);
    }

    // Update active nav link
    updateActiveNavLink(pageName);

    // Update URL
    window.history.pushState({ page: pageName }, '', `/?page=${pageName}`);

  showLoading(false);
// Helper: fetch with timeout
async function fetchWithTimeout(resource, ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(resource, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}
  } catch (error) {
    console.error('Error loading page:', error);
    showLoading(false);
    document.getElementById('main-content').innerHTML = `
      <div class="page-content">
        <div class="card">
          <h2>⚠ Error Loading Page</h2>
          <p>Sorry, we couldn't load the page you requested. Please try again.</p>
        </div>
      </div>
    `;
  }
}

/**
 * Setup navigation click listeners
 */
function setupNavigation() {
  document.addEventListener('click', (e) => {
    const navLink = e.target.closest('.nav-link');
    if (navLink) {
      e.preventDefault();
      const pageName = navLink.dataset.page;
      loadPage(pageName);
    }
  });
}

/**
 * Update active nav link styling
 */
function updateActiveNavLink(pageName) {
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.remove('active');
  });
  document.querySelector(`[data-page="${pageName}"]`)?.classList.add('active');
}

/**
 * Get page name from URL
 */
function getPageFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('page');
}

/**
 * Show/hide loading indicator
 */
function showLoading(show) {}

/**
 * Setup notification button
 */
function setupNotificationButton() {
  const notificationBtn = document.querySelector('.notification-btn');
  if (notificationBtn) {
    notificationBtn.addEventListener('click', () => {
      console.log('Notifications clicked');
      // You can add notification panel logic here
      alert('Notifications: You have 3 new messages');
    });
  }
}

/**
 * Setup account button
 */
function setupAccountButton() {
  const accountBtn = document.querySelector('.account-btn');
  if (accountBtn) {
    accountBtn.addEventListener('click', () => {
      console.log('Account clicked');
      // You can add account info popup here
      alert('Account: John Doe\njohn.doe@example.com');
    });
  }
}

/**
 * Setup logout button
 */
function setupLogout() {
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to logout?')) {
        console.log('Logging out...');
        // Redirect to logout endpoint
        window.location.href = '/logout';
      }
    });
  }
}

/**
 * Handle browser back/forward buttons
 */
window.addEventListener('popstate', (e) => {
  const pageName = e.state?.page || 'dashboard';
  loadPage(pageName);
});