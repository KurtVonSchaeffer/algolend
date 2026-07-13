// Shared stylesheets always active — loaded in the same order as the legacy app.
// Page-specific CSS (10-20) is loaded dynamically per page via usePageCSS()
// to replicate the legacy's loadPageStylesheet() and prevent cross-page conflicts.
import './00-theme.css';
import './01-style.css';
import './02-animations.css';
import './03-enhancements.css';
import './04-navbar.css';
import './05-sidebar.css';
import './99-design-system.css';
