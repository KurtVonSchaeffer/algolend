export interface AdminNavItem {
  href: string;
  icon: string;
  label: string;
}

export interface AdminNavSubmenu {
  id: string;
  label: string;
  icon: string;
  children: AdminNavItem[];
}

export interface AdminNavGroup {
  section: string;
  items: AdminNavItem[];
  submenu?: AdminNavSubmenu;
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    section: 'Overview',
    items: [{ href: '/dashboard', icon: 'dashboard', label: 'Dashboard' }],
    submenu: {
      id: 'analytics',
      label: 'Analytics',
      icon: 'bar_chart',
      children: [
        { href: '/analytics', icon: 'analytics', label: 'Customer Analytics' },
        { href: '/financials', icon: 'account_balance', label: 'Financials' },
      ],
    },
  },
  {
    section: 'Applications',
    items: [
      { href: '/applications', icon: 'assignment', label: 'Applications' },
      { href: '/create-application', icon: 'add_circle', label: 'New Application' },
    ],
  },
  {
    section: 'Finance',
    items: [{ href: '/mandates', icon: 'receipt_long', label: 'Mandates' }],
    submenu: {
      id: 'payments',
      label: 'Payments',
      icon: 'payments',
      children: [
        { href: '/incoming-payments', icon: 'south_west', label: 'Incoming' },
        { href: '/outgoing-payments', icon: 'north_east', label: 'Outgoing' },
      ],
    },
  },
  {
    section: 'Tools',
    items: [
      { href: '/credit-rules', icon: 'rule', label: 'Credit Rules' },
      { href: '/portfolio', icon: 'analytics', label: 'Portfolio' },
      { href: '/loan-book', icon: 'menu_book', label: 'Loan Book' },
      { href: '/cash-ledger', icon: 'account_balance_wallet', label: 'Cash Ledger' },
    ],
  },
  {
    section: 'Compliance',
    items: [
      { href: '/sacrra', icon: 'verified_user', label: 'SACRRA' },
      { href: '/sacrra-validator', icon: 'rule_folder', label: 'Migration Validator' },
      { href: '/ncr-reporting', icon: 'assignment', label: 'NCR Reporting' },
      { href: '/ncr-registers', icon: 'manage_accounts', label: 'NCR Registers' },
      { href: '/compliance-tracker', icon: 'checklist', label: 'Compliance Tracker' },
      { href: '/goaml', icon: 'security', label: 'FIC goAML' },
    ],
  },
  {
    section: 'Settings',
    items: [],
    submenu: {
      id: 'settings',
      label: 'Settings',
      icon: 'settings',
      children: [
        { href: '/settings', icon: 'tune', label: 'General' },
        { href: '/settings/user-management', icon: 'group', label: 'User Management' },
      ],
    },
  },
];

export function getExpandedNavIds(pathname: string): Record<string, boolean> {
  return {
    analytics: pathname.includes('/analytics') || pathname.includes('/financials'),
    payments: pathname.includes('/incoming-payments') || pathname.includes('/outgoing-payments'),
    settings: pathname.includes('/settings'),
  };
}
