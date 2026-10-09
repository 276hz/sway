// Sway: kiểm thử giao diện thật (Chromium headless). TÙY CHỌN — cần Playwright (npm i -g playwright && npx playwright install chromium).
// ffmpeg được GIẢ lập trong trang (không cần mạng); máy chủ tĩnh áp dụng đúng _headers nên CSP thật được kiểm tra.
//   NODE_PATH=$(npm root -g) node tools/ui-test.mjs
import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http'; import cp from 'node:child_process'; import os from 'node:os';
import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium, devices } = require(process.env.PW_MODULE || 'playwright');
const ROOT = process.argv[2] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } }; const section = n => console.log('\n# ' + n);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain' };
// ---- _headers → tiêu đề phản hồi ----
const rules = []; { let cur = null; for (const l of fs.readFileSync(path.join(ROOT, '_headers'), 'utf8').split('\n')) { if (!l.trim() || l.startsWith('#')) continue; if (/^\S/.test(l)) { cur = { pat: new RegExp('^' + l.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'), h: {} }; rules.push(cur); } else { const i = l.indexOf(':'); cur.h[l.slice(0, i).trim()] = l.slice(i + 1).trim(); } } }
let swSuffix = '';
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); let p = decodeURIComponent(u.pathname);
  if (p === '/en' || p === '/vi') { res.writeHead(308, { Location: p + '/' }); return res.end(); }
  let f = path.join(ROOT, p); if (p.endsWith('/')) f = path.join(f, 'index.html');
  const send = (code, body, type) => { const h = { 'Content-Type': type }; for (const r of rules) if (r.pat.test(p)) Object.assign(h, r.h); res.writeHead(code, h); res.end(body); };
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { const nf = path.join(ROOT, '404.html'); return send(404, fs.readFileSync(nf), MIME['.html']); }
  let body = fs.readFileSync(f); if (p === '/sw.js') body = Buffer.concat([body, Buffer.from(swSuffix)]);
  send(200, body, MIME[path.extname(f)] || 'application/octet-stream');
});
await new Promise(r => server.listen(0, '127.0.0.1', r)); const BASE = 'http://127.0.0.1:' + server.address().port;

const MOCK = `(() => { const W = window; W.__mock = { instances: 0, terminated: 0, loads: [], log: [] };
  const enc = new TextEncoder(), dec = new TextDecoder();
  class FFmpeg { constructor() { this.h = {}; this.fs = new Map(); this.pend = []; this.dead = false; this.id = ++W.__mock.instances; }
    on(e, f) { (this.h[e] ||= []).push(f); } off(e, f) { this.h[e] = (this.h[e] || []).filter(x => x !== f); } emit(e, d) { (this.h[e] || []).forEach(f => f(d)); }
    async load(c) { W.__mock.loads.push(c); for (const k of ['classWorkerURL', 'coreURL', 'wasmURL']) if (!/^blob:/.test(c[k])) throw new Error('mock: ' + k + ' is not a blob URL'); await new Promise(r => setTimeout(r, 20)); }
    terminate() { this.dead = true; W.__mock.terminated++; this.pend.splice(0).forEach(j => j(new Error('called FFmpeg.terminate()'))); }
    async writeFile(n, d) { if (this.dead) throw new Error('terminated'); this.fs.set(n, d); return true; }
    async readFile(n) { if (!this.fs.has(n)) throw new Error('ErrnoError: ' + n); return this.fs.get(n); }
    async deleteFile(n) { if (!this.fs.delete(n)) throw new Error('ErrnoError: ' + n); return true; }
    async listDir() { return [...this.fs.keys()].map(name => ({ name, isDir: false })); }
    exec(args) { return new Promise((res, rej) => {
      if (this.dead) return rej(new Error('terminated')); this.pend.push(rej);
      const inp = this.fs.get('in'), mk = inp ? dec.decode(inp.subarray(0, 4)) : '', out = args[args.length - 1], done = c => { const i = this.pend.indexOf(rej); if (i >= 0) this.pend.splice(i, 1); res(c); };
      W.__mock.log.push(args.join(' '));
      if (args.length === 2 && args[0] === '-i') { const L = ["Input #0, mp3, from 'in':", '  Duration: ' + (mk === 'LONG' ? '02:00:00.00' : '00:00:01.00') + ', start: 0.000000, bitrate: 128 kb/s']; if (mk !== 'BAD_') L.push('  Stream #0:0: Audio: mp3, 44100 Hz, stereo, fltp, 128 kb/s'); setTimeout(() => { L.forEach(m => this.emit('log', { type: 'stderr', message: m })); done(1); }, 5); return; }
      if (mk === 'HANG') return;
      if (out === 'dec.wav') { if (mk === 'OOM_') { const i = this.pend.indexOf(rej); this.pend.splice(i, 1); return rej(new Error('memory access out of bounds')); }
        const n = 44100, b = new ArrayBuffer(44 + n * 8), v = new DataView(b), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
        w(0, 'RIFF'); v.setUint32(4, 36 + n * 8, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 3, true); v.setUint16(22, 2, true); v.setUint32(24, 44100, true); v.setUint32(28, 44100 * 8, true); v.setUint16(32, 8, true); v.setUint16(34, 32, true); w(36, 'data'); v.setUint32(40, n * 8, true);
        const f = new Float32Array(b, 44); for (let i = 0; i < n; i++) { f[2 * i] = Math.sin(i * 0.05) * 0.4; f[2 * i + 1] = Math.sin(i * 0.07) * 0.4; } this.fs.set('dec.wav', new Uint8Array(b)); return setTimeout(() => done(0), 10); }
      if (/^out\\./.test(out)) { this.emit('progress', { progress: 0.5, time: 0 }); this.fs.set(out, enc.encode('OUT:' + out + ':' + 'x'.repeat(3000))); return setTimeout(() => done(0), 10); }
      done(0); }); } }
  W.FFmpegWASM = { FFmpeg }; })();`;
const CDN = /^https:\/\/(cdn\.jsdelivr\.net|fastly\.jsdelivr\.net|unpkg\.com)\//;
async function setup(browser, opts = {}) {
  const ctx = await browser.newContext({ ...(opts.device || { viewport: { width: 1280, height: 800 } }), acceptDownloads: true, serviceWorkers: opts.sw ? 'allow' : 'block' });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.route(CDN, async r => { const u = r.request().url();
    if (u.endsWith('/ffmpeg.js')) return r.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: MOCK });
    if (u.endsWith('.wasm') && opts.slowWasm) await new Promise(res => setTimeout(res, 8000));
    if (u.endsWith('.wasm')) return r.fulfill({ status: 200, contentType: 'application/wasm', headers: { 'access-control-allow-origin': '*' }, body: Buffer.alloc(3 << 20) });
    return r.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: '/* mock */' }); });
  const page = await ctx.newPage(), errs = []; page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|ERR_FAILED|Failed to load resource|^UserError|memory access out of bounds/.test(m.text() + (m.location().url || ''))) errs.push('console: ' + m.text()); });
  page.on('requestfailed', r => { if (!/fonts\./.test(r.url())) errs.push('requestfailed: ' + r.url()); });
  return { ctx, page, errs };
}
const txt = async page => page.evaluate(() => { const o = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); while (w.nextNode()) { const e = w.currentNode.parentElement; if (e && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(e.tagName)) o.push(w.currentNode.textContent); } document.querySelectorAll('option').forEach(e => o.push(e.textContent)); document.querySelectorAll('[aria-label]').forEach(e => o.push(e.getAttribute('aria-label'))); o.push(document.title); return o.join('\n'); });
const VI = /[ăâđêôơưĂÂĐÊÔƠƯàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/, CJK = /[\u4e00-\u9fff]/;
const msg = page => page.locator('#msg').innerText();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'] });

section('A. Tải trang, CSP, ngôn ngữ');
{ const { ctx, page, errs } = await setup(browser); const csp = []; page.on('console', m => { if (/Content.Security.Policy/i.test(m.text())) csp.push(m.text()); });
  await page.goto(BASE + '/'); await page.waitForSelector('#row-speed', { state: 'attached' });
  ok((await page.title()).includes('音频'), 'tiêu đề zh'); ok(await page.locator('html').getAttribute('lang') === 'zh-CN', 'lang zh-CN'); ok((await msg(page)).includes('设备') || (await msg(page)).length > 5, 'thông điệp ban đầu: ' + (await msg(page)));
  ok(await page.locator('#go').isDisabled(), 'nút chuyển đổi tắt khi chưa có file'); ok(await page.evaluate(() => document.querySelectorAll('#adv .row').length) > 40, 'bảng nâng cao được dựng');
  for (const l of ['zh', 'en', 'vi']) { await page.selectOption('#lang', l); await page.click('#advbtn'); const adv = await page.locator('#adv').isVisible(); if (!adv) await page.click('#advbtn'); const t = await txt(page);
    const t2 = t.replace(/Tiếng Việt/g, '').replace(/中文/g, '');
    if (l === 'zh') ok(!VI.test(t2), 'zh còn chữ tiếng Việt: ' + (t2.match(new RegExp('.{0,30}' + VI.source + '.{0,20}')) || [''])[0]);
    if (l === 'en') { ok(!VI.test(t2), 'en còn chữ tiếng Việt: ' + (t2.match(new RegExp('.{0,30}' + VI.source + '.{0,20}')) || [''])[0]); ok(!CJK.test(t2), 'en còn chữ Hán: ' + (t2.match(new RegExp('.{0,20}' + CJK.source + '.{0,20}')) || [''])[0]); }
    if (l === 'vi') ok(!CJK.test(t2), 'vi còn chữ Hán: ' + (t2.match(new RegExp('.{0,20}' + CJK.source + '.{0,20}')) || [''])[0]);
    ok(await page.locator('html').getAttribute('lang') === ({ zh: 'zh-CN', en: 'en', vi: 'vi' })[l], 'lang đổi theo ngôn ngữ ' + l); const ld = JSON.parse(await page.locator('#ld-faq').textContent()); ok(ld.mainEntity.length === 5, 'FAQ JSON-LD 5 mục');
    ok((await page.locator('meta[name=description]').getAttribute('content')).length > 40, 'meta description ' + l); if (await page.locator('#adv').isVisible()) await page.click('#advbtn'); }
  ok(csp.length === 0, 'CSP chặn tài nguyên: ' + csp.join(' | ')); ok(errs.length === 0, 'lỗi console: ' + errs.join(' | ')); await ctx.close(); }
for (const [p, lang, h1] of [['/en/', 'en', /Convert audio/], ['/vi/', 'vi', /Chuyển đổi/], ['/', 'zh-CN', /音频与视频转换/]]) { const { ctx, page, errs } = await setup(browser); await page.goto(BASE + p); await page.waitForSelector('#row-speed', { state: 'attached' });
  ok(await page.locator('html').getAttribute('lang') === lang, p + ' lang sau khi JS chạy'); ok(h1.test(await page.locator('h1').innerText()), p + ' h1: ' + await page.locator('h1').innerText()); ok(errs.length === 0, p + ' lỗi: ' + errs.join('|'));
  const st = await page.evaluate(() => document.documentElement.dataset.fixedLang || ''); ok(p === '/' ? st === '' : st === lang, p + ' data-fixed-lang'); await ctx.close(); }
{ const { ctx, page } = await setup(browser); const r = await page.goto(BASE + '/khong-co'); ok(r.status() === 404 && (await page.content()).includes('noindex'), '404 thật + noindex'); await ctx.close(); }

section('B. Thêm file → chuyển đổi → ZIP; lỗi; hủy; thông báo đổi ngôn ngữ giữa chừng');
{ const { ctx, page, errs } = await setup(browser); await page.goto(BASE + '/'); await page.waitForSelector('#row-speed', { state: 'attached' });
  const f = (name, body) => ({ name, mimeType: 'audio/mpeg', buffer: Buffer.from(body.padEnd(40, '.')) });
  await page.setInputFiles('#file', [f('Bài hát 歌.mp3', 'OKAY'), f('Bài hát 歌.mp3'.replace('.mp3', '.wav'), 'OKAY'), f('bad.mp3', 'BAD_'), f('oom.mp3', 'OOM_'), f('last.mp3', 'OKAY')]);
  ok(await page.locator('.file').count() === 5, '5 dòng file'); ok(await page.locator('#go').isEnabled(), 'nút chuyển đổi bật'); ok((await page.locator('.x').first().getAttribute('aria-label')).includes('Bài hát'), 'nút xóa có tên file trong aria-label');
  ok((await msg(page)).includes('5'), 'đếm file: ' + await msg(page)); await page.selectOption('#fmt', 'flac'); await page.click('#go');
  await page.waitForFunction(() => !document.querySelector('#go').classList.contains('pri') === false && !document.querySelector('.x').disabled, null, { timeout: 15000 });
  const rows = await page.$$eval('.file', rs => rs.map(r => ({ name: r.querySelector('.fn').textContent, st: r.querySelector('.fs').innerText, link: r.querySelector('.fs a') ? { href: r.querySelector('.fs a').href, dl: r.querySelector('.fs a').download } : null, bad: r.querySelector('.fs').classList.contains('bad') })));
  ok(rows[0].link && /^blob:/.test(rows[0].link.href) && rows[0].link.dl === 'Bài hát 歌-sway.flac', 'liên kết tải #1: ' + JSON.stringify(rows[0])); ok(rows[1].link && rows[1].link.dl === 'Bài hát 歌-sway.flac', 'liên kết tải #2: ' + JSON.stringify(rows[1]));
  ok(rows[2].bad && /无法解码/.test(rows[2].st), 'bad → decE (zh): ' + rows[2].st); ok(rows[3].bad && /内存/.test(rows[3].st) && !/memory access/.test(rows[3].st), 'OOM → thông báo thân thiện, không lộ lỗi kỹ thuật: ' + rows[3].st);
  ok(rows[4].link, 'file sau lỗi vẫn được xử lý (ffmpeg được nạp lại): ' + JSON.stringify(rows[4])); const m = await page.evaluate(() => ({ i: __mock.instances, t: __mock.terminated })); ok(m.i === 2 && m.t >= 1, 'sau lỗi lạ phải dựng lại ffmpeg: ' + JSON.stringify(m));
  ok(await page.locator('#zip').isVisible(), 'nút ZIP hiện khi ≥ 2 kết quả'); ok((await msg(page)).includes('3'), 'tóm tắt: ' + await msg(page));
  await page.selectOption('#lang', 'en'); ok(/Download/.test(await page.locator('.file').first().locator('.fs').innerText()), 'liên kết tải đổi sang tiếng Anh'); ok(/could not decode|Could not decode/i.test(await page.locator('.file').nth(2).locator('.fs').innerText()), 'lỗi dòng đổi sang tiếng Anh'); ok(/Download all/.test(await page.locator('#zip').innerText()), 'nút ZIP đổi ngôn ngữ'); ok(/3/.test(await msg(page)) && /done|Done|finished/i.test(await msg(page)), 'thông báo cuối đổi ngôn ngữ: ' + await msg(page));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#zip')]); const zp = path.join(os.tmpdir(), 'ui.zip'); await dl.saveAs(zp);
  try { const o = cp.execFileSync('python3', ['-c', "import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print('|'.join(i.filename+':'+str(i.file_size) for i in z.infolist()))", zp]).toString().trim(); ok(o.split('|').length === 3 && o.includes('Bài hát 歌-sway.flac') && o.includes('Bài hát 歌-sway (1).flac'), 'ZIP: ' + o); } catch (e) { ok(false, 'ZIP không hợp lệ: ' + e.message.split('\n')[0]); }
  ok(await page.locator('#go').innerText() !== '', 'nút chính có nhãn'); ok(errs.length === 0, 'lỗi: ' + errs.join(' | ')); await ctx.close(); }
{ const { ctx, page } = await setup(browser); await page.goto(BASE + '/'); await page.waitForSelector('#row-speed', { state: 'attached' }); await page.setInputFiles('#file', [{ name: 'hang.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('HANG'.padEnd(30, '.')) }, { name: 'next.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('OKAY'.padEnd(30, '.')) }]);
  await page.click('#go'); await page.waitForFunction(() => /\d+%|…|\.\.\./.test(document.querySelector('.fs').innerText) || document.querySelector('#msg').innerText.length > 0); await page.waitForTimeout(400);
  ok(await page.locator('#go').innerText() === '取消', 'nút đổi thành Hủy khi đang chạy: ' + await page.locator('#go').innerText()); ok(await page.locator('#pbar').isVisible(), 'thanh tiến độ hiện'); await page.click('#go');
  await page.waitForFunction(() => document.querySelector('#go').innerText === '转换', null, { timeout: 8000 }); ok(/取消/.test(await page.locator('.fs').first().innerText()), 'dòng bị hủy: ' + await page.locator('.fs').first().innerText()); ok(await page.locator('.fs').nth(1).innerText() === '', 'file chưa chạy không còn "đang chờ"'); ok(await page.locator('#go').isEnabled() && !(await page.locator('.x').first().isDisabled()), 'UI được mở lại sau khi hủy'); ok(await page.locator('#pbar').isHidden(), 'thanh tiến độ ẩn');
  await page.click('#go'); await page.waitForTimeout(100); await page.click('#go'); await page.waitForFunction(() => document.querySelector('#go').innerText === '转换'); ok(true); await ctx.close(); }

section('C. Cảnh báo lệch tiếng-hình (MP4/MKV), metadata, nghe thử');
{ const { ctx, page } = await setup(browser); await page.goto(BASE + '/'); await page.waitForSelector('#row-speed', { state: 'attached' }); await page.selectOption('#lang', 'en');
  await page.selectOption('#fmt', 'mp4'); ok(await page.locator('#vwarn').isHidden(), 'không cảnh báo khi cài đặt không đổi độ dài');
  await page.click('#advbtn'); await page.locator('#speed').evaluate(e => { e.value = 80; e.dispatchEvent(new Event('input', { bubbles: true })); }); ok(await page.locator('#vwarn').isVisible() && /out of sync/.test(await page.locator('#vwarn').innerText()) && /speed/.test(await page.locator('#vwarn').innerText()), 'cảnh báo lệch khi đổi tốc độ: ' + await page.locator('#vwarn').innerText());
  await page.selectOption('#fmt', 'flac'); ok(await page.locator('#vwarn').isHidden(), 'ẩn cảnh báo khi chọn định dạng chỉ-âm-thanh'); await page.selectOption('#fmt', 'ogg'); ok(/cover/i.test(await page.locator('#mnote').innerText()), 'ghi chú metadata cho ogg: ' + await page.locator('#mnote').innerText()); await page.selectOption('#fmt', 'mp3'); ok(await page.locator('#mnote').isHidden(), 'mp3: không cần ghi chú');
  await page.setInputFiles('#file', [{ name: 'a.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('OKAY'.padEnd(30, '.')) }]); await page.selectOption('#preset', 'c8d'); await page.click('#pv'); await page.waitForFunction(() => /Stop/.test(document.querySelector('#pv').innerText), null, { timeout: 15000 });
  ok(/Stop/.test(await page.locator('#pv').innerText()), 'nút nghe thử → Dừng'); await page.selectOption('#lang', 'zh'); ok(/停止/.test(await page.locator('#pv').innerText()), 'nhãn Dừng giữ nguyên khi đổi ngôn ngữ lúc đang phát: ' + await page.locator('#pv').innerText()); await page.click('#pv'); await page.waitForTimeout(200); ok(!/停止/.test(await page.locator('#pv').innerText()), 'dừng nghe thử'); await ctx.close(); }

section('D. Mobile (iPhone 13 emulation) và truy cập bàn phím');
{ const { ctx, page } = await setup(browser, { device: devices['iPhone 13'] }); await page.goto(BASE + '/vi/'); await page.waitForSelector('#row-speed', { state: 'attached' });
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(over <= 1, 'tràn ngang trên mobile: ' + over + 'px'); await page.setInputFiles('#file', [{ name: 'a very long file name that should be truncated nicely 歌歌歌歌歌歌歌歌歌歌歌歌歌歌歌歌.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('OKAY'.padEnd(30, '.')) }]);
  ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1, 'tên file dài không làm tràn ngang'); const sizes = await page.$$eval('#go,#pv,#advbtn,.x', els => els.map(e => Math.round(e.getBoundingClientRect().height))); ok(sizes.every(h => h >= 40), 'vùng chạm ≥ 40px: ' + sizes);
  await page.click('#advbtn'); ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1, 'panel nâng cao không tràn ngang'); const act = await page.locator('.act').boundingBox(); ok(act && act.y + act.height <= 844 + 1, 'thanh hành động dính đáy màn hình'); await ctx.close(); }
{ const { ctx, page } = await setup(browser); await page.goto(BASE + '/'); await page.waitForSelector('#row-speed', { state: 'attached' }); const names = await page.evaluate(() => [...document.querySelectorAll('button,select,input:not([type=hidden])')].filter(e => !e.closest('[hidden]')).map(e => { const lab = e.id && document.querySelector('label[for="' + e.id + '"]'); const n = e.getAttribute('aria-label') || (lab && lab.textContent.trim()) || (e.closest('label') && e.closest('label').innerText.trim()) || e.textContent.trim(); return [e.id || e.tagName, n]; })); ok(names.every(([, n]) => n), 'phần tử tương tác thiếu tên truy cập: ' + names.filter(([, n]) => !n).map(x => x[0]));
  await page.click('#advbtn'); const unl = await page.evaluate(() => [...document.querySelectorAll('#adv input,#adv select')].filter(e => !e.closest('[hidden]')).filter(e => { const lab = document.querySelector('label[for="' + e.id + '"]'); return !(lab && lab.textContent.trim()); }).map(e => e.id)); ok(unl.length === 0, 'điều khiển nâng cao thiếu nhãn: ' + unl); ok(await page.locator('#row-speed input').getAttribute('aria-valuetext') === '1.00×', 'slider có aria-valuetext: ' + await page.locator('#row-speed input').getAttribute('aria-valuetext'));
  await page.keyboard.press('Tab'); ok(await page.evaluate(() => document.activeElement && document.activeElement !== document.body), 'Tab di chuyển focus'); await ctx.close(); }

section('E. Service worker: cài đặt, offline, cập nhật');
{ const { ctx, page, errs } = await setup(browser, { sw: true }); await page.goto(BASE + '/'); await page.waitForSelector('#row-speed', { state: 'attached' }); await page.evaluate(() => navigator.serviceWorker.ready); await page.reload(); await page.waitForSelector('#row-speed', { state: 'attached' });
  const keys = await page.evaluate(async () => { const o = {}; for (const k of await caches.keys()) o[k] = (await (await caches.open(k)).keys()).length; return o; }); ok(keys['sway-shell-v16'] >= 19, 'vỏ ứng dụng đã được lưu: ' + JSON.stringify(keys));
  ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'trang được SW kiểm soát');
  await ctx.setOffline(true); await page.reload(); await page.waitForSelector('#row-speed', { state: 'attached' }); ok((await page.title()).includes('音频'), 'mở lại offline từ SW'); await page.goto(BASE + '/en/?utm=1'); ok(/Convert audio/.test(await page.locator('h1').innerText()), '/en/ có query mở được offline');
  await page.setInputFiles('#file', [{ name: 'a.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('OKAY'.padEnd(30, '.')) }]); await page.click('#go'); await page.waitForFunction(() => /\S/.test(document.querySelector('#msg').innerText) && document.querySelector('#go').classList.contains('pri') && !document.querySelector('.x').disabled, null, { timeout: 15000 }); ok(/(offline|Offline|离线)/.test(await msg(page)) || /CDN|引擎/.test(await msg(page)), 'offline + chưa có engine → thông báo rõ ràng: ' + await msg(page));
  await ctx.setOffline(false); swSuffix = '\n// version bump'; await page.goto(BASE + '/'); await page.waitForSelector('#row-speed', { state: 'attached' }); await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
  await page.waitForFunction(() => !document.querySelector('#upd').hidden, null, { timeout: 10000 }).then(() => ok(true), () => ok(false, 'banner "có bản mới" không hiện sau khi sw.js đổi')); swSuffix = ''; await ctx.close(); }


section('F. Ghép cặp (Xuân-Hạ), âm thanh quá dài, ảnh bìa không hợp lệ');
{ const f = (name, body) => ({ name, mimeType: 'audio/mpeg', buffer: Buffer.from(body.padEnd(40, '.')) });
  { const { ctx, page, errs } = await setup(browser); await page.goto(BASE + '/'); await page.waitForSelector('#row-speed', { state: 'attached' });
    await page.setInputFiles('#file', [f('left.mp3', 'OKAY'), f('right.mp3', 'OKAY')]); ok(!(await page.$eval('#preset option[value=xuanha]', o => o.disabled)), 'Xuân-Hạ bật khi có đúng 2 file');
    await page.selectOption('#preset', 'xuanha'); const lab = await page.$$eval('.fs', e => e.map(x => x.innerText)); ok(lab[0] && lab[1] && lab[0] !== lab[1], 'nhãn kênh trái/phải: ' + lab);
    await page.selectOption('#fmt', 'flac'); await page.click('#go'); await page.waitForFunction(() => document.querySelector('.fs a'), null, { timeout: 15000 });
    const dl = await page.$eval('.fs a', a => a.download); ok(dl === 'left + right-sway.flac', 'tên file ghép cặp: ' + dl); ok(await page.locator('a[download]').count() === 1, 'chỉ một kết quả khi ghép cặp'); ok(/1\/1|1/.test(await msg(page)), 'tóm tắt ghép cặp: ' + await msg(page));
    await page.setInputFiles('#file', [f('third.mp3', 'OKAY')]); ok(await page.locator('#preset').inputValue() === 'none', 'thêm file thứ 3 → thoát chế độ Xuân-Hạ'); ok(errs.length === 0, 'lỗi: ' + errs.join('|')); await ctx.close(); }
  { const { ctx, page } = await setup(browser); await page.goto(BASE + '/'); await page.waitForSelector('#row-speed', { state: 'attached' }); await page.setInputFiles('#file', [f('l.mp3', 'OKAY'), f('r.mp3', 'OKAY')]); await page.selectOption('#preset', 'xuanha'); await page.selectOption('#fmt', 'mp4'); await page.click('#go');
    await page.waitForFunction(() => /春夏/.test(document.querySelector('#msg').innerText), null, { timeout: 10000 }).then(() => ok(true), () => ok(false, 'ghép cặp + MP4 phải báo lỗi rõ')); ok(await page.evaluate(() => typeof __mock === 'undefined' ? 0 : __mock.log.length) <= 2, 'không chạy ffmpeg khi cấu hình không hợp lệ'); await ctx.close(); }
  { const { ctx, page } = await setup(browser); await page.goto(BASE + '/'); await page.waitForSelector('#row-speed', { state: 'attached' }); await page.setInputFiles('#file', [f('LONG.mp3', 'LONG')]); await page.click('#go'); await page.waitForFunction(() => /120/.test(document.querySelector('#msg').innerText), null, { timeout: 10000 }).then(() => ok(true), () => ok(false, 'âm thanh 2 giờ phải bị chặn với thông báo có số phút')); ok(await page.evaluate(() => typeof __mock === 'undefined' || !__mock.log.some(l => l.includes('dec.wav'))), 'không giải mã khi vượt giới hạn'); await ctx.close(); }
  { const { ctx, page } = await setup(browser); await page.goto(BASE + '/'); await page.waitForSelector('#row-speed', { state: 'attached' }); await page.selectOption('#fmt', 'mp3'); await page.click('#advbtn'); await page.setInputFiles('#cover', { name: 'cover.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('this is not an image') });
    await page.setInputFiles('#file', [f('a.mp3', 'OKAY')]); await page.click('#go'); await page.waitForFunction(() => /JPG/.test(document.querySelector('#msg').innerText), null, { timeout: 10000 }).then(() => ok(true), () => ok(false, 'ảnh bìa giả phải bị từ chối')); ok(await page.evaluate(() => typeof __mock === 'undefined' ? 0 : __mock.instances) === 0, 'từ chối ảnh bìa trước khi nạp ffmpeg'); ok(await page.locator('#go').isEnabled(), 'UI mở lại sau lỗi ảnh bìa'); await ctx.close(); }
}

section('G. Hủy ngay khi đang tải engine (mạng chậm)');
{ const { ctx, page } = await setup(browser, { slowWasm: true }); await page.goto(BASE + '/'); await page.waitForSelector('#row-speed', { state: 'attached' }); await page.setInputFiles('#file', [{ name: 'slow.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('OKAY'.padEnd(40, '.')) }, { name: 'slow2.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('OKAY'.padEnd(40, '.')) }]);
  await page.click('#go'); await page.waitForTimeout(500); ok(await page.locator('#go').innerText() === '取消', 'đang tải engine: nút là Hủy'); const t0 = Date.now(); await page.click('#go');
  await page.waitForFunction(() => document.querySelector('#go').innerText === '转换', null, { timeout: 3000 }).then(() => ok(Date.now() - t0 < 2500, 'hủy phản hồi nhanh (' + (Date.now() - t0) + ' ms)'), () => ok(false, 'nút Hủy không phản hồi trong 3 giây khi đang tải engine'));
  ok(/已取消|取消/.test(await page.locator('.fs').first().innerText()), 'dòng đầu hiển thị đã hủy'); ok(await page.evaluate(() => typeof __mock === 'undefined' || __mock.instances === 0), 'không tạo FFmpeg sau khi hủy'); ok(await page.locator('.fs').nth(1).innerText() === '', 'dòng chưa chạy được xóa trạng thái chờ'); await ctx.close(); }

console.log(`\n${pass} đạt, ${fail} lỗi`); await browser.close(); server.close(); process.exit(fail ? 1 : 0);
