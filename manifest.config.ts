import packageJson from './package.json';

const { version } = packageJson;
const [major, minor, patch] = version.replace(/[^\d.]+/g, '').split('.');

const manifest = {
  manifest_version: 3,
  name: 'LinkHub Bookmark Manager',
  description: 'Trang quản lý bookmark khi mở tab mới — đồng bộ đám mây',
  version: `${major}.${minor}.${patch}`,
  version_name: version,
  permissions: ['storage', 'contextMenus', 'activeTab'],
  host_permissions: ['https://*.supabase.co/*'],
  // Khi mở tab mới → hiển thị trang quản lý bookmark (không phải popup)
  chrome_url_overrides: {
    newtab: 'src/newtab/index.html',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'LinkHub',
  },
  options_ui: {
    page: 'src/options/index.html',
    open_in_tab: true,
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_security_policy: {
    // connect-src cần cả ws:// cho Vite HMR (WebSocket)
    extension_pages:
      "script-src 'self' http://localhost:5173 http://127.0.0.1:5173; object-src 'self'; connect-src 'self' http://localhost:5173 http://127.0.0.1:5173 ws://localhost:5173 ws://127.0.0.1:5173 https://*.supabase.co https://*.supabase.in https://fonts.googleapis.com https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com;",
  },
};

export default manifest;
