// Sway: trạng thái, xử lý theo lô, nghe thử, tải xuống, đổi ngôn ngữ, khởi động
// ---- trạng thái ----
let files = [], results = [], urls = [], busy = false, job = null, pvCtx = null, wl = null, curIdx = 0, pairJob = false, zipUrl = null, zipName = '', outBytes = 0;
const fmtDur = s => { if (!s) return '—'; s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
const fmtSize = b => b >= 1073741824 ? (b / 1073741824).toFixed(2) + ' GB' : b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const extOf = n => (n.includes('.') ? n.split('.').pop() : 'file').slice(0, 5).toUpperCase();
const revoke = () => urls.splice(0).forEach(u => URL.revokeObjectURL(u));
const HL = { zh: 'zh-CN', en: 'en', vi: 'vi' };   // giá trị hreflang

// ---- lỗi: luôn quy về thông báo dễ hiểu (chuyện gì xảy ra / vì sao / làm gì tiếp); chi tiết kỹ thuật chỉ ở console ----
const isOOM = e => /memory|out of bounds|allocation|array buffer|typed array length|invalid array length|\boom\b|unreachable|aborted/i.test(String((e && e.message) || e));
const isNet = e => /failed to fetch|networkerror|network error|load failed/i.test(String((e && e.message) || e));
const errText = e => () => e instanceof UserError ? t(e.key, e.vars) : isOOM(e) ? t('oom') : isNet(e) ? t('net') : t('errGeneric');

// Giữ màn hình sáng khi đang xử lý (iOS/Android khóa màn hình sẽ làm treo tác vụ); xin lại khi quay về tab
const keepAwake = async on => { try { if (on && 'wakeLock' in navigator) { if (!wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } } else if (wl) { const w = wl; wl = null; await w.release(); } } catch (_) {} };
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && busy) keepAwake(true); });

const stopPreview = () => { if (pvCtx) { pvCtx.close().catch(() => {}); pvCtx = null; } $('pv').textContent = t('prev'); };
function cancel() { if (job) job.abort(); terminateFF(); }

// Thời lượng do trình duyệt đọc (nhẹ hơn ffmpeg; không đọc được thì 0). Tối đa 3 file cùng lúc để thả cả trăm file không treo máy.
const probeQ = []; let probing = 0;
const probeOne = f => new Promise(res => {
  const m = document.createElement(f.type.startsWith('video') ? 'video' : 'audio'), u = URL.createObjectURL(f); let fin = false, tm;
  const done = d => { if (fin) return; fin = true; clearTimeout(tm); URL.revokeObjectURL(u); m.removeAttribute('src'); try { m.load(); } catch (_) {} res(d); };
  m.preload = 'metadata'; m.onloadedmetadata = () => done(isFinite(m.duration) ? m.duration : 0); m.onerror = () => done(0); tm = setTimeout(() => done(0), 4000); m.src = u;
});
function pumpProbe() { while (probing < 3 && probeQ.length) { const [f, res] = probeQ.shift(); probing++; probeOne(f).then(d => { probing--; res(d); pumpProbe(); }); } }
const probe = f => new Promise(res => { probeQ.push([f, res]); pumpProbe(); });

function syncUI() {
  $('ws').classList.toggle('has', files.length > 0); $('ws').setAttribute('aria-busy', String(busy));
  $('dt').textContent = t((files.length ? 'drop1' : 'drop0') + (COARSE ? 'c' : ''));
  $('go').disabled = busy ? false : !files.length; $('pv').disabled = busy || !files.length;
}
function setBusy(b) {
  busy = b; $('go').textContent = t(b ? 'cancel' : 'go'); $('go').classList.toggle('pri', !b);
  document.querySelectorAll('#tool select,#adv select,#adv input,.x,#file').forEach(el => { el.disabled = b; });
  syncUI();
}

// ---- dòng file: trạng thái lưu dạng dữ liệu ({k: ...}) để vẽ lại đúng ngôn ngữ khi người dùng đổi ngôn ngữ giữa chừng ----
function dlLink(r) { const a = document.createElement('a'), s = t('dl', { s: fmtSize(r.size) }); a.href = r.url; a.download = r.name; a.textContent = s; a.setAttribute('aria-label', s + ': ' + r.name); return a; }
function paintRow(x) {
  const el = x.row.querySelector('.fs'), s = x.st || { k: '' };
  el.className = 'fs' + (s.k === 'err' ? ' bad' : '');
  if (s.k === 'done' && x.res) el.replaceChildren(dlLink(x.res));
  else el.textContent = s.k === 'wait' ? t('wait') : s.k === 'prog' ? s.p + '%' : s.k === 'cancel' ? t('cancelled') : s.k === 'err' ? s.msg() : s.k === 'pairL' ? t('pairL') : s.k === 'pairR' ? t('pairR') : s.k === 'pairD' ? t('pairD') : '';
}
function resetRows() { revoke(); results = []; outBytes = 0; zipUrl = null; $('zip').hidden = true; files.forEach(x => { x.res = null; x.st = { k: '' }; x.row.style.setProperty('--p', '0%'); paintRow(x); }); }

// Cảnh báo bộ nhớ MỀM (chỉ là ước lượng): PCM float32 stereo sau giải mã lớn hơn nhiều so với file nén, nên ước theo THỜI LƯỢNG chứ không theo dung lượng file.
// Ngưỡng tỉ lệ với navigator.deviceMemory (Chrome/Android; trần 8); Safari/iOS không có số liệu nên coi là thiết bị nhỏ.
const DEV_MEM = navigator.deviceMemory || ((/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) ? 2 : 4);
const BUDGET = DEV_MEM * 1e8;
const isVideo = f => /^video\//.test(f.type) || /\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(f.name);
const heavyHint = (f, dur) => (dur ? dur * 48000 * 8 : f.size * 12) + (isVideo(f) ? f.size * 2 : 0) > BUDGET;
const selMsg = () => { if (!files.length) return t('idle'); const big = files.find(x => x.big); return t('sel', { n: files.length }) + (big ? ' ' + t('big', { f: big.file.name }) : ''); };

function addFiles(list) {
  if (!list.length) return;   // thả chữ/liên kết hoặc hủy hộp thoại chọn file: giữ nguyên kết quả đang có
  if (busy) { status(() => t('waitBusy')); return; }
  let added = 0;
  for (const f of list) {
    if (files.some(x => x.file.name === f.name && x.file.size === f.size && x.file.lastModified === f.lastModified)) continue;
    const row = document.createElement('li'); row.className = 'file';
    row.innerHTML = '<div class="fi"><div class="fn"></div><div class="fm"></div></div><div class="fs"></div><button type="button" class="x">×</button><i class="fp"></i>';
    row.querySelector('.fn').textContent = f.name; row.querySelector('.x').setAttribute('aria-label', t('rm') + ': ' + f.name);
    const meta = row.querySelector('.fm'), x = { file: f, row, st: { k: '' }, res: null, big: heavyHint(f, 0) }, kind = extOf(f.name), size = fmtSize(f.size);
    meta.textContent = kind + ' · ' + size;
    probe(f).then(d => { meta.textContent = kind + ' · ' + fmtDur(d) + ' · ' + size; x.big = heavyHint(f, d); if (curStatus && curStatus.x === selMsg) paintStatus(); });
    row.querySelector('.x').addEventListener('click', () => { if (busy) return; files = files.filter(y => y !== x); row.remove(); resetRows(); syncUI(); syncPair(); status(selMsg); });
    files.push(x); $('files').appendChild(row); added++;
  }
  if (!added) return;   // toàn file trùng
  resetRows(); syncUI(); syncPair(); status(selMsg);
}
const setProg = f => {
  const x = files[curIdx]; if (!x) return; const pct = Math.round(clampN(f, 0, 1, 0) * 100);
  x.row.style.setProperty('--p', pct + '%'); x.st = { k: 'prog', p: pct }; paintRow(x); bar((curIdx + f) / (pairJob ? 1 : files.length));
};

// ---- Xuân-Hạ: file 1 → kênh trái, file 2 → kênh phải (mỗi file trộn về mono, file ngắn hơn được đệm im lặng) ----
// Giải mã file 2 trước để 'in' còn lại là file 1 → tag và ảnh bìa lấy từ file 1; file 1 được ép về cùng sample rate với file 2.
const mono = d => { const m = new Float32Array(d.L.length); for (let i = 0; i < m.length; i++) m[i] = (d.L[i] + d.R[i]) / 2; return m; };
const padTo = (m, n) => { if (m.length === n) return m; const p = new Float32Array(n); p.set(m); return p; };
async function mergePair(a, b, P, secs, rate0, jb) {
  const dB = await decode(b, P, secs, rate0, jb), rate = dB.rate, mB = mono(dB); dB.L = dB.R = null;
  const dA = await decode(a, P, secs, rate, jb), mA = mono(dA), cover = dA.cover; dA.L = dA.R = null;
  const n = Math.max(mA.length, mB.length), L = padTo(mA, n), R = padTo(mB, n);
  return { rate, L, R, cover, length: n, sampleRate: rate, getChannelData: c => c ? R : L };
}
// Ảnh bìa thay thế: kiểm tra đúng JPG/PNG và cỡ hợp lý trước khi bắt đầu (lỗi sớm, không đợi tới lúc xuất)
async function readCover() {
  const f = $('cover').files[0]; if (!f) return null;
  if (f.size > 16 << 20) throw new UserError('badCover');
  const u = new Uint8Array(await f.arrayBuffer());
  const jpg = u[0] === 0xFF && u[1] === 0xD8 && u[2] === 0xFF, png = u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4E && u[3] === 0x47;
  if (!jpg && !png) throw new UserError('badCover');
  return u;
}

// Vòng đời một file: nạp → giải mã (PCM) → DSP → ghi WAV → [giải phóng PCM ở luồng chính] → mã hóa → đọc kết quả → dọn
async function convert(jb, file, P, tag, other) {
  const F = FORMATS[P.fmt];
  if (file.size > MAX_FILE || (other && other.size > MAX_FILE)) throw new UserError('huge');
  if (other && F.video) throw new UserError('pairVid');
  setProg(0);
  const dec = other ? await mergePair(file, other, P, 0, 0, jb) : await decode(file, P, 0, 0, jb);
  const rate = dec.rate, srcCover = dec.cover, pcm = dec.L.length * 8;
  status(() => tag + t('fx')); setProg(0.1); await tick(); chk(jb);
  let out = other ? dec : await fx(dec, P, v => { chk(jb); setProg(0.1 + 0.4 * v); });
  chk(jb); status(() => tag + t('exp') + P.fmt.toUpperCase() + '…'); setProg(0.5);
  const wav = await toWavF32(out, P.none ? 0 : P.peak, P.none ? 'down' : P.norm, v => { chk(jb); setProg(0.5 + 0.1 * v); });
  out = null; dec.L = dec.R = null;   // từ đây PCM chỉ còn trong ffmpeg (file đã chuyển sang worker, không còn bản ở luồng chính)
  const f = await abortable(loadFF(), jb); chk(jb);
  await f.writeFile('fx.wav', wav);
  if (P.coverData && COVER_FMT.includes(P.fmt)) await f.writeFile('cover.img', P.coverData.slice());
  const onP = ({ progress }) => { if (!jb.cancelled) setProg(0.6 + 0.4 * clampN(progress, 0, 1, 0)); };
  f.on('progress', onP);
  let rc; try { rc = await execG(f, buildArgs({ ...P, srcCover }, rate)); } finally { f.off('progress', onP); }
  chk(jb);
  try { await f.deleteFile('fx.wav'); } catch (_) {}   // trả bộ nhớ PCM trong ffmpeg trước khi đọc kết quả
  if (rc !== 0) throw new UserError('expE');
  const data = await f.readFile('out.' + F.ext); try { await f.deleteFile('out.' + F.ext); } catch (_) {}
  try { await f.deleteFile('cover.img'); } catch (_) {}
  const stem = n => fileSafe(n.replace(/\.[^.]+$/, ''), '', 70);
  return { name: fileSafe(stem(file.name) + (other ? ' + ' + stem(other.name) : '') + '-sway', F.ext), data, pcm };
}
async function runAll() {
  stopPreview(); const P = getP(), pair = P.pair && files.length === 2; job = newJob(); const jb = job;
  pairJob = pair; resetRows(); setBusy(true); keepAwake(true);
  files.forEach(x => { x.st = { k: 'wait' }; paintRow(x); });
  let heavy = 0, fatal = false, firstErr = null;
  const finish = () => { bar(null); setBusy(false); keepAwake(false); setZip('idle'); };
  if (P.cover && COVER_FMT.includes(P.fmt) && !FORMATS[P.fmt].video) {
    try { P.coverData = await readCover(); } catch (e) { files.forEach(x => { x.st = { k: '' }; paintRow(x); }); status(errText(e), true); finish(); return; }
  }
  for (let i = 0; i < (pair ? 1 : files.length) && !jb.cancelled && !fatal; i++) {
    curIdx = i; const x = files[i];
    try {
      const r = await convert(jb, x.file, { ...P, idx: i + 1, cnt: pair ? 1 : files.length }, files.length > 1 && !pair ? `(${i + 1}/${files.length}) ` : '', pair ? files[1].file : null);
      heavy = Math.max(heavy, r.pcm);
      r.blob = new Blob([r.data], { type: 'application/octet-stream' }); r.size = r.blob.size; r.data = null; r.crc = null;   // bản trong bộ nhớ JS được trả ngay; CRC chỉ tính khi tạo ZIP
      r.url = URL.createObjectURL(r.blob); urls.push(r.url); outBytes += r.size; results.push(r); x.res = r; x.st = { k: 'done' };
      if (pair) files[1].st = { k: 'pairD' };
    } catch (e) {
      if (jb.cancelled || e instanceof CancelError) x.st = { k: 'cancel' };
      else { (e instanceof UserError ? console.warn : console.error)(e); x.st = { k: 'err', msg: errText(e) }; firstErr = firstErr || errText(e); if (e instanceof UserError && ['ffe', 'ffo', 'fft'].includes(e.key)) fatal = true; else if (!(e instanceof UserError)) terminateFF(); }   // không nạp được ffmpeg → dừng cả lô; lỗi lạ: ffmpeg có thể đã hỏng → nạp lại cho file sau
      if (pair) files[1].st = x.st;
    } finally { x.row.style.setProperty('--p', '0%'); paintRow(x); if (pair) paintRow(files[1]); await wipe(); }
    if (heavy > HEAVY_PCM) { terminateFF(); heavy = 0; }   // bộ nhớ wasm không bao giờ co lại: trả lại sau file nặng
  }
  if (fatal) files.forEach(x => { if (x.st.k === 'wait') { x.st = { k: '' }; paintRow(x); } });
  if (jb.cancelled) files.forEach(x => { if (x.st.k === 'wait') { x.st = { k: '' }; paintRow(x); } });
  const risk = FORMATS[P.fmt].video ? syncRisk(P) : [], total = pair ? 1 : files.length;
  if (!jb.cancelled && !results.length && firstErr) status(firstErr, true);
  else status(() => jb.cancelled ? t('cancelled') : t('done', { a: results.length, b: total }) + (risk.length ? ' ' + t('vsyncS') : '') + (results.length > 1 && outBytes > BUDGET * 2 ? ' ' + t('outBig') : ''), !jb.cancelled && !results.length);
  finish();
}
async function preview() {
  if (pvCtx) { stopPreview(); return; }
  let ac; try { ac = new (window.AudioContext || window.webkitAudioContext)(); ac.resume().catch(() => {}); }   // tạo ngay trong thao tác bấm để iOS cho phép phát
  catch (e) { console.error(e); status(() => t('noPv'), true); return; }
  const P = getP(); job = newJob(); const jb = job; let playing = false; setBusy(true); bar('busy');
  try {
    const pair = P.pair && files.length === 2;
    if (pair && FORMATS[P.fmt].video) throw new UserError('pairVid');
    const dec = pair ? await mergePair(files[0].file, files[1].file, P, 20, ac.sampleRate, jb) : await decode(files[0].file, P, 20, ac.sampleRate, jb);   // giải mã đúng sample rate của AudioContext
    status(() => t('pvb')); await tick(); chk(jb);
    let lastP = -1;
    const out = pair ? dec : await fx(dec, P, v => { chk(jb); bar(v); const p = Math.floor(v * 10); if (p !== lastP) { lastP = p; status(() => t('pvb') + ' ' + p * 10 + '%'); } });
    const L = out.getChannelData(0), R = out.getChannelData(1), n = out.length;
    let pk = 0; for (let i = 0; i < n; i++) { const a = Math.abs(L[i]), b = Math.abs(R[i]); if (a - a === 0 && a > pk) pk = a; if (b - b === 0 && b > pk) pk = b; }
    const g = pk > 0.89 ? 0.89 / pk : 1, b = ac.createBuffer(2, n, out.sampleRate), l = b.getChannelData(0), r = b.getChannelData(1);
    for (let i = 0; i < n; i++) { const x = L[i] * g, y = R[i] * g; l[i] = x - x === 0 ? x : 0; r[i] = y - y === 0 ? y : 0; }
    const src = ac.createBufferSource(); src.buffer = b; src.connect(ac.destination);
    src.onended = () => { if (pvCtx === ac) { stopPreview(); status(selMsg); } };
    src.start(); pvCtx = ac; playing = true; $('pv').textContent = t('stop');
    status(() => t('pvp'));
  } catch (e) {
    if (jb.cancelled || e instanceof CancelError) status(() => t('cancelled'));
    else { (e instanceof UserError ? console.warn : console.error)(e); status(errText(e), true); if (!(e instanceof UserError)) terminateFF(); }
  } finally { await wipe(); bar(null); setBusy(false); if (!playing) ac.close().catch(() => {}); }
}
$('file').addEventListener('change', e => { addFiles([...e.target.files]); e.target.value = ''; });
$('go').addEventListener('click', () => { if (busy) cancel(); else if (files.length) runAll(); });
$('pv').addEventListener('click', () => { if (!busy && files.length) preview(); });

// ---- ZIP: CRC tính theo khúc từ Blob lúc cần; tên file được làm sạch + khử trùng (không phân biệt hoa/thường) ----
let zipP = 0;
const setZip = (st, p) => { zipP = p || 0; const z = $('zip'); z.hidden = results.length < 2; z.dataset.state = st; z.disabled = st === 'busy'; z.textContent = st === 'busy' ? t('zip1', { p: Math.round((p || 0) * 100) }) : t(st === 'done' ? 'zip2' : st === 'err' ? 'zipE' : 'zip0'); };
const saveUrl = (u, n) => { const a = document.createElement('a'); a.href = u; a.download = n; document.body.appendChild(a); a.click(); a.remove(); };
$('zip').addEventListener('click', async () => {
  if (zipUrl) return saveUrl(zipUrl, zipName);
  setZip('busy', 0);
  try {
    if (results.reduce((s, r) => s + r.size, 0) > ZMAX) throw new Error('zip-limit');
    const used = new Set(), list = []; let k = 0;
    for (const r of results) {
      if (r.crc == null) r.crc = await crc32Blob(r.blob, p => setZip('busy', (k + p) / results.length * 0.5));
      list.push({ name: uniqueName(r.name, used), blob: r.blob, crc: r.crc, size: r.size }); k++;
    }
    zipUrl = URL.createObjectURL(await zipStore(list, p => setZip('busy', 0.5 + p / 2))); urls.push(zipUrl);
    zipName = 'sway-' + new Date().toISOString().slice(0, 10) + '.zip'; setZip('done'); saveUrl(zipUrl, zipName);
  } catch (e) { console.error(e); zipUrl = null; setZip('err'); status(() => e.message === 'zip-limit' ? t('zipBig') : t('zipE'), true); }
});

// ---- kéo thả / vòng đời trang ----
const drop = $('drop');
$('ws').addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
$('ws').addEventListener('dragleave', e => { if (!$('ws').contains(e.relatedTarget)) drop.classList.remove('over'); });
$('ws').addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); addFiles([...e.dataTransfer.files]); });
addEventListener('dragover', e => e.preventDefault()); addEventListener('drop', e => e.preventDefault());
addEventListener('beforeunload', e => { if (busy) { e.preventDefault(); e.returnValue = ''; } });
addEventListener('unhandledrejection', e => console.warn('unhandledrejection', e.reason));
// Service worker: đăng ký theo gốc site (đúng cả ở /en/ và /vi/); kiểm tra bản mới mỗi giờ và khi quay lại tab
if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
  const had = !!navigator.serviceWorker.controller;   // chỉ báo "có bản mới" khi trang đã được SW cũ kiểm soát (không báo ở lần cài đầu)
  navigator.serviceWorker.register(ROOT + 'sw.js', { scope: ROOT }).then(reg => {
    const upd = () => reg.update().catch(() => {});
    setInterval(upd, 3600e3); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') upd(); });
  }).catch(e => console.warn('[sway] service worker not registered', e));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had) return;
    const show = () => { $('upd').hidden = false; document.body.style.paddingTop = $('upd').offsetHeight + 'px'; };   // đẩy trang xuống để không che header
    if (!busy) return show();
    const iv = setInterval(() => { if (!busy) { clearInterval(iv); show(); } }, 1500);   // không làm gián đoạn khi đang chuyển đổi
  });
  $('updb').addEventListener('click', () => location.reload());
}

// ---- ngôn ngữ ----
function fillPreset() {
  const sel = $('preset'), cur = sel.value, og = (n, items) => { const g = document.createElement('optgroup'); g.label = n; items.forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.disabled = v === 'xuanha' && files.length !== 2; o.textContent = l; g.appendChild(o); }); return g; };
  sel.replaceChildren(...PGROUPS.map(([, ks], i) => og(t('g' + i), ks.map(k => [k, pname(k) + (k === 'xuanha' && files.length !== 2 ? ' · ' + t('pair2') : '')]))), og(t('g6'), [['custom', t('custom')]])); sel.value = cur;
}
const FAQ_IDS = [5, 7, 9, 11, 13];
const ldFaq = () => JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: LC[LANG], mainEntity: FAQ_IDS.map(i => ({ '@type': 'Question', name: t('i' + i), acceptedAnswer: { '@type': 'Answer', text: t('i' + (i + 1)) } })) });
function applyLang(l, user) {
  LANG = l; document.documentElement.lang = LC[l]; $('lang').value = l;
  if (user) {
    try { localStorage.setItem('sway.lang', l); } catch (_) {}
    try { const a = document.querySelector('link[rel=alternate][hreflang="' + HL[l] + '"]'); if (a) { const u = new URL(a.href); if (u.origin === location.origin) history.replaceState(null, '', u.pathname + location.search + location.hash); } } catch (_) {}   // URL theo ngôn ngữ để chia sẻ/tải lại đúng bản
  }
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.title = t('title'); document.querySelector('meta[name=description]').content = t('desc'); $('ld-faq').textContent = ldFaq();
  $('ws').setAttribute('aria-label', t('wsl')); $('pbar').setAttribute('aria-label', t('wsp')); document.querySelector('.langs').setAttribute('aria-label', t('langl')); $('lang').setAttribute('aria-label', t('langl'));
  $('slot-preset').querySelector('span').textContent = t('effect'); $('slot-fmt').querySelector('span').textContent = t('outfmt');
  files.forEach(x => x.row.querySelector('.x').setAttribute('aria-label', t('rm') + ': ' + x.file.name));
  fillPreset(); trAdv(); CTL.forEach(showVal); refresh(); syncUI(); setBusy(busy); syncPair(true);
  files.forEach(paintRow); if (pvCtx) $('pv').textContent = t('stop');
  if (curStatus) paintStatus(); else status(selMsg);
  { const zs = $('zip').dataset.state; setZip(zs === 'busy' ? 'busy' : zs === 'err' ? 'err' : zipUrl ? 'done' : 'idle', zipP); }
}
CTL.forEach(showVal);
$('ws').addEventListener('input', e => { const c = CTL.find(x => x.id === e.target.id); if (!c) return; showVal(c); if (c.fx) $('preset').value = 'custom'; refresh(); syncPair(true); });
$('ws').addEventListener('change', save);
$('preset').addEventListener('change', () => { if ($('preset').value !== 'custom') applyPreset($('preset').value); syncPair(); });
$('advbtn').addEventListener('click', () => { const open = $('adv').hidden; $('adv').hidden = !open; $('advbtn').setAttribute('aria-expanded', String(open)); });
applyPreset('none'); loadSaved();
$('lang').addEventListener('change', e => applyLang(e.target.value, true));
document.querySelectorAll('.langs a').forEach(a => a.addEventListener('click', e => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return; e.preventDefault(); applyLang(a.dataset.lang, true); }));
applyLang(LANG);
