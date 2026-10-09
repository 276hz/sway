// Sway service worker.
// - Vỏ ứng dụng (cùng origin): ưu tiên MẠNG để luôn là bản mới nhất; có bản lưu thì chỉ chờ mạng NET_WAIT ms rồi dùng bản lưu (mạng yếu không làm trang treo).
// - Thư viện/lõi ffmpeg và font (CDN, URL đã ghim phiên bản): ưu tiên bản lưu, tách riêng khỏi vỏ → nâng phiên bản app KHÔNG làm tải lại ~30 MB.
// - Chỉ lưu phản hồi CORS thành công (script nạp bằng crossorigin="anonymous"); không lưu 206/lỗi/opaque.
importScripts('js/config.js');
const SHELL_V = 'sway-shell-v16';                       // đổi tên khi sửa danh sách SHELL hoặc muốn buộc làm mới toàn bộ
const LIB = 'sway-lib-' + SWAY.ffmpeg + '-' + SWAY.core; // đổi theo phiên bản ghim trong js/config.js
const NET_WAIT = 4000;
const SHELL = ['./', 'en/', 'vi/', 'index.html', 'css/styles.css', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'apple-touch-icon.png',
  'js/config.js', 'js/i18n-data.js', 'js/i18n.js', 'js/core.js', 'js/formats.js', 'js/effects.js', 'js/presets.js', 'js/controls.js', 'js/ffmpeg.js', 'js/zip.js', 'js/app.js'];
const CDN = new Set(['cdn.jsdelivr.net', 'fastly.jsdelivr.net', 'unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com']);

self.addEventListener('install', e => {
  // cache:'reload' bỏ qua cache HTTP: bản cài đặt luôn lấy file mới từ máy chủ
  e.waitUntil(caches.open(SHELL_V).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('sway-') && k !== SHELL_V && k !== LIB).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const okRes = res => res && res.ok && res.status === 200;
async function shell(r, e) {
  const nav = r.mode === 'navigate', hit = await caches.match(r, { ignoreSearch: nav });
  const net = fetch(r).then(res => {
    if (okRes(res) && res.type === 'basic') { const cp = res.clone(); e.waitUntil(caches.open(SHELL_V).then(c => c.put(r, cp)).catch(() => {})); }
    return res;
  });
  e.waitUntil(net.catch(() => {}));
  if (!hit) { try { return await net; } catch (_) { return (nav && await caches.match('./')) || Response.error(); } }
  return Promise.race([net.then(res => okRes(res) ? res : hit, () => hit), new Promise(res => setTimeout(() => res(hit), NET_WAIT))]);
}
async function lib(r, e, host) {
  const cache = await caches.open(LIB), hit = await cache.match(r);
  const net = () => fetch(r).then(res => { if (okRes(res)) { const cp = res.clone(); e.waitUntil(cache.put(r, cp).catch(() => {})); } return res; });
  if (hit) { if (host === 'fonts.googleapis.com') e.waitUntil(net().catch(() => {})); return hit; }   // CSS font: trả bản lưu rồi làm mới nền
  return net();
}
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin) e.respondWith(shell(r, e));
  else if (CDN.has(u.hostname)) e.respondWith(lib(r, e, u.hostname));
});
