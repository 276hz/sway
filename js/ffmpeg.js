// Sway: nạp ffmpeg.wasm (phiên bản ghim trong config.js), chạy lệnh có canh treo, thăm dò file, giải mã
// Kiến trúc: thư viện UMD (@ffmpeg/ffmpeg, vài KB) nạp lười khi cần → worker + lõi wasm (~30 MB) tải qua fetch (có tiến độ, hủy được)
// → blob URL → FFmpeg.load(). Blob URL được thu hồi ngay sau khi nạp xong. Một lần nạp duy nhất dù gọi đồng thời nhiều nơi.
let ff = null, ffLoad = null, ffGen = 0, ffAbort = null, ffPending = null, ffLibP = null;
const ffPkg = (base, pkg, ver, path) => base + pkg + '@' + ver + '/' + path;

function loadScript(url, sri) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = url; s.async = true; s.crossOrigin = 'anonymous';   // CORS để Service Worker lưu được bản sao (phản hồi "opaque" không lưu được → mất offline)
    if (sri) s.integrity = sri;
    const tm = setTimeout(() => { s.remove(); rej(new Error('script timeout ' + url)); }, 20000);
    s.onload = () => { clearTimeout(tm); res(); }; s.onerror = () => { clearTimeout(tm); s.remove(); rej(new Error('script ' + url)); };
    document.head.appendChild(s);
  });
}
function ffLib() {
  if (window.FFmpegWASM) return Promise.resolve();
  return ffLibP || (ffLibP = (async () => {
    let last;
    for (const base of SWAY.cdn) {
      try { await loadScript(ffPkg(base, '@ffmpeg/ffmpeg', SWAY.ffmpeg, 'dist/umd/ffmpeg.js'), SWAY.sri['ffmpeg.js']); if (window.FFmpegWASM) return; }
      catch (e) { last = e; }
    }
    throw last || new Error('ffmpeg lib');
  })().catch(e => { ffLibP = null; throw e; }));
}
// Nguồn nạp theo thứ tự: ./vendor (chỉ khi SWAY.vendor = true) rồi lần lượt các CDN. Worker UMD (cổ điển) đi với lõi UMD — đúng cặp theo tài liệu ffmpeg.wasm;
// nếu khởi tạo lõi UMD lỗi thì thử lõi ESM (tổ hợp mà bản cũ của Sway đã dùng) trên cùng CDN trước khi chuyển CDN khác.
function ffSources() {
  const list = [];
  if (SWAY.vendor) list.push({ host: 'vendor', worker: ROOT + 'vendor/' + SWAY.worker, core: ROOT + 'vendor' });
  for (const base of SWAY.cdn) for (const dir of ['umd', 'esm']) list.push({ host: base, worker: ffPkg(base, '@ffmpeg/ffmpeg', SWAY.ffmpeg, 'dist/umd/' + SWAY.worker), core: ffPkg(base, '@ffmpeg/core', SWAY.core, 'dist/' + dir) });
  return list;
}
async function verifySri(blob, sri) {
  const [alg, b64] = sri.split('-'), name = { sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' }[alg];
  if (!name || !b64) return;
  const h = new Uint8Array(await crypto.subtle.digest(name, await blob.arrayBuffer()));
  let s = ''; h.forEach(b => { s += String.fromCharCode(b); });
  if (btoa(s) !== b64) throw new Error('SRI mismatch');
}
// Tải về Blob có tiến độ + hủy được (không dùng toBlobURL của @ffmpeg/util: không hủy được, và báo "tải chưa đủ" khi CDN nén nội dung)
async function fetchBlobURL(url, type, sri, onP, signal) {
  const inner = new AbortController(); let last = Date.now(), stalled = false;
  const onAbort = () => inner.abort(); signal.addEventListener('abort', onAbort);
  const iv = setInterval(() => { if (Date.now() - last > 25000) { stalled = true; inner.abort(); } }, 3000);   // treo không báo lỗi: bỏ nguồn này, thử nguồn khác
  try {
    const r = await fetch(url, { signal: inner.signal, credentials: 'omit' });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
    const total = r.headers.get('content-encoding') ? 0 : (+r.headers.get('content-length') || 0), chunks = []; let got = 0;
    if (r.body && r.body.getReader) {
      const rd = r.body.getReader();
      for (;;) { const { done, value } = await rd.read(); if (done) break; last = Date.now(); chunks.push(value); got += value.length; onP && onP(got, total); }
    } else { const u = new Uint8Array(await r.arrayBuffer()); chunks.push(u); got = u.length; }
    if (total && got !== total) throw new Error('incomplete download ' + url);
    return await finishBlob(chunks, type, sri);
  } catch (e) { if (stalled) throw new Error('stalled ' + url); throw e; }
  finally { clearInterval(iv); signal.removeEventListener('abort', onAbort); }
}
async function finishBlob(chunks, type, sri) {
  const blob = new Blob(chunks, { type });
  if (sri) await verifySri(blob, sri);
  return URL.createObjectURL(blob);
}
const withTimeout = (p, ms) => new Promise((res, rej) => { const id = setTimeout(() => rej(new UserError('fft')), ms); p.then(v => { clearTimeout(id); res(v); }, e => { clearTimeout(id); rej(e); }); });

async function doLoad(gen) {
  const live = () => { if (gen !== ffGen) throw new CancelError(); };
  try { await ffLib(); } catch (e) { console.warn('[sway] ffmpeg library failed to load', e); throw new UserError(navigator.onLine === false ? 'ffo' : 'ffe'); }
  live();
  let timedOut = false; const dead = new Set();   // host đã lỗi ở bước TẢI (mạng): bỏ qua biến thể còn lại của host đó
  for (const src of ffSources()) {
    live(); if (dead.has(src.host)) continue;
    let phase = 'net';
    const ctl = ffAbort = new AbortController(), urls = [], rev = () => urls.splice(0).forEach(u => URL.revokeObjectURL(u));
    let f = null;
    try {
      const get = async (u, type, key, prog) => { const b = await fetchBlobURL(u, type, SWAY.sri[key], prog, ctl.signal); urls.push(b); live(); return b; };
      const classWorkerURL = await get(src.worker, 'text/javascript', 'worker');
      const coreURL = await get(src.core + '/ffmpeg-core.js', 'text/javascript', 'core.js');
      let lastMB = -1;
      const wasmURL = await get(src.core + '/ffmpeg-core.wasm', 'application/wasm', 'core.wasm', (got, total) => {
        const m = Math.floor(got / 1048576); if (m === lastMB) return; lastMB = m;
        status(() => t('ffl') + ' ' + m + (total > 0 ? '/' + Math.round(total / 1048576) : '') + ' MB');
      });
      live(); status(() => t('ffs')); phase = 'init';
      f = ffPending = new FFmpegWASM.FFmpeg();
      await withTimeout(f.load({ classWorkerURL, coreURL, wasmURL }), 90000);
      live();
      ffPending = null; rev();   // đã nạp xong: trả lại ~30 MB blob
      return (ff = f);
    } catch (e) {
      rev(); ffPending = null; try { f && f.terminate(); } catch (_) {}
      if (gen !== ffGen || e instanceof CancelError) throw new CancelError();   // hủy thật luôn tăng ffGen trước khi abort
      if (e instanceof UserError && e.key === 'fft') timedOut = true;
      if (phase === 'net') dead.add(src.host);
      console.warn('[sway] ffmpeg source failed:', src.core, e);
    }
  }
  throw new UserError(navigator.onLine === false ? 'ffo' : timedOut ? 'fft' : 'ffe');
}
function loadFF() {
  if (ff) return Promise.resolve(ff);
  if (!ffLoad) { const gen = ffGen, p = doLoad(gen).finally(() => { if (ffLoad === p) ffLoad = null; }); ffLoad = p; }
  return ffLoad;
}
// Dừng và bỏ ffmpeg hiện tại (hủy tác vụ / giải phóng bộ nhớ wasm vốn không bao giờ co lại / thoát trạng thái hỏng sau lỗi)
function terminateFF() {
  ffGen++;
  if (ffAbort) { try { ffAbort.abort(); } catch (_) {} ffAbort = null; }
  for (const f of [ff, ffPending]) if (f) { try { f.terminate(); } catch (_) {} }
  ff = ffPending = ffLoad = null;
}
// Xóa mọi file tạm trong hệ thống file ảo (kể cả file lạ), không phụ thuộc danh sách tên cố định
async function wipe() {
  if (!ff) return; const f = ff;
  try { for (const it of await f.listDir('/')) if (!it.isDir) { try { await f.deleteFile(it.name); } catch (_) {} } }
  catch (_) { for (const n of ['in', 'cover.img', 'fx.wav', 'dec.wav', 'r.wav', ...new Set(Object.values(FORMATS).map(x => 'out.' + x.ext))]) { try { await f.deleteFile(n); } catch (_) {} } }
}
// Chạy lệnh ffmpeg có canh treo: 2 phút không có tín hiệu nào thì dừng và báo lỗi thay vì chờ mãi
async function execG(f, args) {
  let last = Date.now(), dead = false;
  const bump = () => { last = Date.now(); };
  f.on('log', bump); f.on('progress', bump);
  const iv = setInterval(() => { if (Date.now() - last > 120000) { dead = true; clearInterval(iv); terminateFF(); } }, 5000);
  try { return await f.exec(args); }
  catch (e) { if (dead) throw new UserError('ffd'); throw e; }
  finally { clearInterval(iv); try { f.off('log', bump); f.off('progress', bump); } catch (_) {} }
}

// Phân tích log của `ffmpeg -i in` (không có đầu ra; ffmpeg trả mã lỗi nhưng vẫn in thông tin luồng)
function parseProbe(lines) {
  const txt = lines.join('\n'), info = { ok: /Input #0/.test(txt), dur: 0, rate: 0, hasAudio: false, hasVideo: false, cover: null };
  const d = txt.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/); if (d) info.dur = +d[1] * 3600 + +d[2] * 60 + +d[3];
  for (const l of lines) {
    const m = l.match(/Stream #0:(\d+)(?:\[[^\]]*\])?(?:\([^)]*\))?: (Audio|Video):(.*)/);
    if (!m) continue;
    if (m[2] === 'Audio') { if (!info.hasAudio) { info.hasAudio = true; const r = m[3].match(/(\d+) Hz/); info.rate = r ? +r[1] : 0; } }
    else if (/attached pic/.test(m[3])) { if (info.cover == null) info.cover = +m[1]; }
    else info.hasVideo = true;
  }
  return info;
}
async function sniffRate(f) {   // dự phòng khi log không có tần số: giải mã 0,1 s rồi đọc từ header WAV
  if (await execG(f, ['-i', 'in', '-vn', '-t', '0.1', '-ac', '2', '-c:a', 'pcm_f32le', 'r.wav']) !== 0) throw new UserError('decE');
  const u8 = await f.readFile('r.wav'); await f.deleteFile('r.wav'); return parseWav(u8).rate;
}
// Giải mã MỘT lượt: stereo hóa → (resample nếu cần) → đặt lại mốc thời gian → bộ lọc người dùng → WAV float32 giữ sample rate gốc.
// secs: giới hạn độ dài ĐẦU RA (nghe thử = 20 giây đầu của kết quả). rate: ép sample rate (ghép cặp / nghe thử).
async function decode(file, P, secs, rate, job) {
  status(() => t('dec')); bar('busy');
  const f = await abortable(loadFF(), job); chk(job);
  await f.writeFile('in', new Uint8Array(await file.arrayBuffer())); chk(job);   // buffer được chuyển sang worker, không giữ bản sao ở luồng chính
  const logs = [], cap = m => { if (logs.length < 600) logs.push(m.message); };
  let info; f.on('log', cap);
  try { await execG(f, ['-i', 'in']); info = parseProbe(logs); } finally { f.off('log', cap); }
  chk(job);
  if (!info.ok || !info.hasAudio) throw new UserError('decE');
  if (!secs && pcmBytes(info.dur, rate || info.rate, P) > MAX_PCM) throw new UserError('tooLong', { m: Math.ceil(info.dur / 60) });
  const sr = rate || info.rate || await sniffRate(f);
  const base = ['aformat=channel_layouts=stereo', ...(rate ? ['aresample=' + rate] : []), 'asetpts=PTS-STARTPTS'], user = decodeFilterList(P, sr);
  const run = chain => execG(f, ['-i', 'in', '-vn', '-af', chain.join(','), ...(secs ? ['-t', String(secs)] : []), '-ac', '2', '-c:a', 'pcm_f32le', 'dec.wav']);
  const rc = await run([...base, ...user]); chk(job);
  if (rc !== 0) {
    if (user.length) { try { await f.deleteFile('dec.wav'); } catch (_) {} const rc2 = await run(base); chk(job); if (rc2 === 0) throw new UserError('fltE'); }   // lỗi do bộ lọc hay do giải mã?
    throw new UserError('decE');
  }
  const u8 = await f.readFile('dec.wav'); await f.deleteFile('dec.wav');   // xóa bản trong ffmpeg ngay: không giữ hai bản
  const dec = parseWav(u8);
  if (!dec.L.length) throw new UserError('noAudio');
  dec.cover = info.cover; dec.dur = info.dur;
  return dec;
}
