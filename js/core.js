// Sway: tiện ích dùng chung — DOM, dòng trạng thái (đổi ngôn ngữ được), thanh tiến độ, lỗi, tên file, nhường luồng
const $ = id => document.getElementById(id);
// Gốc của site (đúng cho /, /en/, /vi/ và cả khi deploy dưới thư mục con): js/core.js nằm ngay dưới gốc.
const ROOT = new URL('../', document.currentScript.src).href;

// Lỗi có khóa i18n: hiển thị lại đúng ngôn ngữ hiện tại, không lộ chuỗi kỹ thuật cho người dùng.
class UserError extends Error { constructor(key, vars) { super(key); this.key = key; this.vars = vars; } }
class CancelError extends Error { constructor() { super('cancelled'); } }

// Dòng trạng thái: nhận chuỗi hoặc hàm () => chuỗi; hàm được chạy lại khi đổi ngôn ngữ.
let curStatus = null;
const paintStatus = () => {
  const m = $('msg'), s = curStatus;
  m.textContent = s ? (typeof s.x === 'function' ? s.x() : s.x) : '';
  m.className = s && s.err ? 'err' : '';
  m.setAttribute('aria-live', s && s.err ? 'assertive' : 'polite');
};
const status = (x, err) => { curStatus = { x, err: !!err }; paintStatus(); };

// Thanh tiến độ tổng: null = ẩn, 'busy' = chạy không xác định, số 0..1 = có tỉ lệ.
const bar = v => {
  const b = $('pbar'); b.hidden = v == null; b.classList.toggle('busy', v === 'busy');
  if (typeof v === 'number') { b.style.setProperty('--p', Math.round(v * 100) + '%'); b.setAttribute('aria-valuenow', String(Math.round(v * 100))); }
  else b.removeAttribute('aria-valuenow');
};

// Một tác vụ (chuyển đổi / nghe thử). job.abort() hủy NGAY cả những bước đang chờ không hủy được (nạp engine, đọc file): dùng với abortable().
const newJob = () => { const j = { cancelled: false }; j.cancelP = new Promise((_, rej) => { j.abort = () => { j.cancelled = true; rej(new CancelError()); }; }); j.cancelP.catch(() => {}); return j; };
const abortable = (p, j) => j && j.cancelP ? Promise.race([p, j.cancelP]) : p;
// Hủy tác vụ đang chạy: ném CancelError nếu `job` đã bị hủy (kiểm tra sau mỗi bước await dài)
const chk = j => { if (j && j.cancelled) throw new CancelError(); };

// Ép số về khoảng [lo, hi]; NaN/không phải số → mặc định d (chặn NaN/Infinity lọt vào DSP và dòng lệnh ffmpeg)
const clampN = (v, lo, hi, d = 0) => { v = +v; return v === v ? Math.min(hi, Math.max(lo, v)) : d; };

// Nhường luồng chính cho giao diện (dùng MessageChannel: không bị trình duyệt giãn timer khi tab ở nền)
const tick = (() => {
  try { const ch = new MessageChannel(), q = []; ch.port1.onmessage = () => q.shift()(); return () => new Promise(r => { q.push(r); ch.port2.postMessage(0); }); }
  catch (_) { return () => new Promise(r => setTimeout(r)); }
})();

// Tên file an toàn: bỏ ký tự điều khiển/đường dẫn/ký tự cấm của Windows, cắt theo BYTE UTF-8 (≤ max), giữ phần mở rộng
const BYTES = s => new TextEncoder().encode(s).length;
function fileSafe(base, ext, max = 180) {
  let b = String(base).normalize('NFC').replace(/[\u0000-\u001f\u007f\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').replace(/^[\s.]+|[\s.]+$/g, '');
  if (!b) b = 'audio';
  const tail = ext ? '.' + ext : '';
  while (b.length > 1 && BYTES(b + tail) > max) b = b.slice(0, -1);
  return b + tail;
}

// Google Fonts nạp không chặn hiển thị (host này có thể chậm/không truy cập được ở một số mạng): chữ hệ thống hiện trước, font tới sau.
(() => {
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.crossOrigin = 'anonymous';
  l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400&display=swap';
  document.head.appendChild(l);
})();
