import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(root, 'apps/admin/src/App.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'apps/admin/src/layout/AdminLayout.tsx'), 'utf8');
const navPath = path.join(root, 'apps/admin/src/layout/adminNav.ts');
const nav = fs.existsSync(navPath) ? fs.readFileSync(navPath, 'utf8') : '';

const checks = [
  ['adminNav exists', fs.existsSync(navPath)],
  ['settings user management route exists', app.includes('settings/user-management')],
  ['legacy users route redirects', app.includes('path="users"') && app.includes('settings/user-management')],
  ['top-level Users href removed from layout', !layout.includes("href: '/users'")],
  ['nav model includes User Management', nav.includes('User Management')],
  ['nav model does not expose top-level Users', !/section:\s*['"]Finance['"][\s\S]*label:\s*['"]Users['"]/.test(nav)],
];

const failed = checks.filter(([, pass]) => !pass);
if (failed.length) {
  console.error(failed.map(([name]) => `FAIL ${name}`).join('\n'));
  process.exit(1);
}
console.log('admin navigation checks passed');
