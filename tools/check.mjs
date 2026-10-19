#!/usr/bin/env node
// Sway: kiểm tra tĩnh + thử nghiệm DSP/định dạng/ZIP + (nếu có ffmpeg gốc) chạy thật pipeline giải mã → hiệu ứng → mã hóa.
// Không cần npm. Chạy: node tools/check.mjs   (thoát mã 1 nếu có lỗi)
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import vm from 'node:vm'; import cp from 'node:child_process'; import nc from 'node:crypto'; import zlib from 'node:zlib'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), R = f => path.join(ROOT, f), read = f => fs.readFileSync(R(f), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } }; const section = n => console.log('\n# ' + n);
const JS = fs.readdirSync(R('js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f);
const ORDER = ['config', 'i18n-data', 'i18n', 'core', 'formats', 'effects', 'presets', 'controls', 'ffmpeg', 'zip', 'app'].map(n => `js/${n}.js`);

section('1. Cú pháp & tham chiếu');
for (const f of [...JS, 'sw.js']) { try { new vm.Script(read(f), { filename: f }); ok(true); } catch (e) { ok(false, f + ': ' + e.message); } }
for (const f of fs.readdirSync(R('tools')).filter(f => f.endsWith('.mjs'))) { try { cp.execFileSync('node', ['--check', R('tools/' + f)], { stdio: 'pipe' }); ok(true); } catch (e) { ok(false, 'tools/' + f + ': ' + String(e.stderr).split('\n')[0]); } }
ok(JS.length === ORDER.length && ORDER.every(f => JS.includes(f)), 'js/ có file ngoài danh sách thứ tự nạp: ' + JS.filter(f => !ORDER.includes(f)));
const pages = { zh: 'index.html', en: 'en/index.html', vi: 'vi/index.html' };
cp.execFileSync('node', [R('tools/build-pages.mjs'), '--check'], { stdio: 'pipe' }); ok(true);   // ném lỗi nếu trang sinh ra bị lệch
const sw = read('sw.js'), shellList = [...sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
for (const f of shellList) ok(f.endsWith('/') || fs.existsSync(R(f)), 'SHELL trỏ tới file không tồn tại: ' + f);
for (const f of ORDER) ok(shellList.includes(f), 'SHELL thiếu ' + f);
for (const [l, f] of Object.entries(pages)) {
  const h = read(f), srcs = [...h.matchAll(/<script src="([^"]+)"/g)].map(m => m[1].replace(/^\.\.\//, ''));
  ok(JSON.stringify(srcs) === JSON.stringify(ORDER), f + ': thứ tự <script> sai: ' + srcs);
  for (const m of h.matchAll(/(?:href|src)="((?:\.\.\/)?[^":#?]+\.(?:css|js|svg|png|webmanifest))"/g)) ok(fs.existsSync(path.join(path.dirname(R(f)), m[1])), f + ': thiếu file ' + m[1]);
  const ids = [...h.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]); ok(new Set(ids).size === ids.length, f + ': id trùng');
  ok(!/\sstyle=/.test(h), f + ': có thuộc tính style nội tuyến (CSP chặn)'); ok(!/<script(?![^>]*(src=|application\/ld\+json))/.test(h), f + ': có script nội tuyến');
  ok(/<link rel="canonical" href="https:\/\/[^"]+">/.test(h), f + ': thiếu canonical'); ok((h.match(/hreflang="/g) || []).length >= 4 + 3, f + ': thiếu hreflang');
  for (const m of h.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) { try { JSON.parse(m[1]); ok(true); } catch (e) { ok(false, f + ': JSON-LD hỏng'); } }
  ok((h.match(/<h1[ >]/g) || []).length === 1, f + ': phải có đúng một h1'); ok(new RegExp('<html lang="' + (l === 'zh' ? 'zh-CN' : l === 'en' ? 'en' : 'vi') + '"').test(h), f + ': lang sai');
  for (const m of h.matchAll(/aria-controls="([^"]+)"/g)) ok(ids.includes(m[1]), f + ': aria-controls trỏ vào id không có: ' + m[1]);
}
const man = JSON.parse(read('manifest.webmanifest'));
for (const i of man.icons) { const p = R(i.src); ok(fs.existsSync(p), 'icon thiếu: ' + i.src); if (i.type === 'image/png' && fs.existsSync(p)) { const b = fs.readFileSync(p), w = b.readUInt32BE(16), hh = b.readUInt32BE(20); ok(i.sizes === `${w}x${hh}`, `${i.src}: sizes ${i.sizes} ≠ ${w}x${hh}`); } }
ok(man.icons.some(i => i.sizes === '192x192') && man.icons.some(i => i.sizes === '512x512') && man.icons.some(i => i.purpose === 'maskable'), 'manifest thiếu icon 192/512/maskable');
const og = fs.readFileSync(R('og.png')); ok(og.readUInt32BE(16) === 1200 && og.readUInt32BE(20) === 630, 'og.png phải 1200x630');
const hd = read('_headers'); ok(hd.split('\n').every(l => l.length < 2000), '_headers: dòng quá dài (giới hạn Cloudflare 2000)');
for (const d of ["script-src 'self' 'wasm-unsafe-eval' blob:", "worker-src 'self' blob:", "connect-src 'self' blob:", "frame-ancestors 'none'", "object-src 'none'"]) ok(hd.includes(d), 'CSP thiếu: ' + d);
ok(/\/sw\.js\n  Cache-Control: no-cache/.test(hd), '_headers: sw.js phải no-cache');
const sm = read('sitemap.xml'); ok(['/', '/en/', '/vi/'].every(p => sm.includes('<loc>https://swaymusic.pages.dev' + p + '</loc>')), 'sitemap thiếu URL'); ok(/Sitemap: https:\/\/swaymusic\.pages\.dev\/sitemap\.xml/.test(read('robots.txt')), 'robots thiếu Sitemap');
ok(!fs.existsSync(R('CNAME')), 'CNAME thừa (Cloudflare Pages không dùng)');

section('2. i18n');
const ctxI = {}; vm.createContext(ctxI); vm.runInContext(read('js/i18n-data.js').replace(/^const /gm, 'var '), ctxI); const D = ctxI.D, TXd = ctxI.TX;
for (const [k, v] of Object.entries(D)) { ok(Array.isArray(v) && v.length === 3 && v.every(s => typeof s === 'string' && s.trim()), 'D.' + k + ' thiếu bản dịch'); const ph = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(); ok(new Set(v.map(ph)).size === 1, `D.${k}: biến {..} không khớp giữa các ngôn ngữ`); }
const used = new Set(); for (const f of JS.filter(f => !f.includes('i18n-data'))) for (const m of read(f).matchAll(/\bt\(\s*'([^']+)'\s*[,)]/g)) used.add(m[1]);
for (const k of used) ok(D[k], 'khóa i18n dùng trong mã nhưng không có trong D: ' + k);
for (const k of ['drop0', 'drop0c', 'drop1', 'drop1c', 'g0', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', ...Array.from({ length: 17 }, (_, i) => 'i' + i)]) ok(D[k], 'thiếu khóa động: ' + k);
for (const k of [...read('tools/index.template.html').matchAll(/data-i18n="([^"]+)"/g)].map(m => m[1])) ok(D[k], 'data-i18n không có trong D: ' + k);

// ---- môi trường giả lập để chạy mã trình duyệt trong Node ----
const dummy = () => { const e = { style: { setProperty() {} }, classList: { toggle() {}, add() {}, remove() {} }, dataset: {}, setAttribute() {}, removeAttribute() {}, appendChild() {}, hidden: false, textContent: '', className: '' }; return e; };
function load(names, extra = {}) {
  const doc = { currentScript: { src: 'https://x.test/js/core.js' }, documentElement: { dataset: {}, lang: '' }, createElement: dummy, head: { appendChild() {} }, getElementById: dummy, body: dummy() };
  const ctx = { document: doc, console, URL, TextEncoder, MessageChannel, setTimeout, clearTimeout, setInterval, clearInterval, Blob, crypto, navigator: { maxTouchPoints: 0, onLine: true }, matchMedia: () => ({ matches: false }), innerWidth: 1000, localStorage: { getItem: () => null, setItem() {} }, ...extra };
  vm.createContext(ctx); for (const n of names) vm.runInContext(read(n), ctx, { filename: n }); return ctx;
}
const S = load(['js/config.js', 'js/i18n-data.js', 'js/i18n.js', 'js/core.js', 'js/formats.js', 'js/effects.js', 'js/presets.js', 'js/zip.js', 'js/ffmpeg.js']);
const ev = c => vm.runInContext(c, S);
const maxAbs = a => { let m = 0; for (let i = 0; i < a.length; i++) { const v = Math.abs(a[i]); if (v > m) m = v; } return m; };
const finite = a => { for (let i = 0; i < a.length; i++) if (!(a[i] - a[i] === 0)) return false; return true; };
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const signal = (sec, rate, amp = 0.6) => { const n = Math.round(sec * rate), L = new Float32Array(n), R = new Float32Array(n); for (let i = 0; i < n; i++) { const s = Math.sin(2 * Math.PI * 220 * i / rate) * amp + (rnd() - 0.5) * 0.1; L[i] = s; R[i] = Math.sin(2 * Math.PI * 330 * i / rate) * amp * 0.8 + (rnd() - 0.5) * 0.1; } return { rate, L, R }; };
const BASE = { rev: 'off', width: 1, kara: 0, eq: 'off', bassdb: 0, middb: 0, trebdb: 0, dly: 'off', dmix: 0.3, fb: 0.4, rv: 'off', mix: 0.25, decay: 1, revAmt: 0, period: 8, rear: 0.8, dist: 0, phase: 0, pmode: 'off', pshape: 'sine', panAmt: 0, fin: 0, fout: 0 };
const PCT = ['speed', 'width', 'kara', 'panAmt', 'revAmt', 'mix', 'decay', 'fb', 'dmix', 'rear', 'dist', 'maxdb'];
const fromPreset = k => { const P = { ...BASE, none: k === 'none' }; for (const [a, v] of Object.entries(ev(`PRESETS['${k}'][1]`))) P[a] = PCT.includes(a) ? v / 100 : v; return P; };

section('3. Hiệu ứng DSP (mọi preset × nhiều sample rate, tham số cực đoan)');
const presetKeys = ev('Object.keys(PRESETS)').filter(k => k !== 'xuanha');
S.__run = async (P, sig) => { const dec = { rate: sig.rate, L: sig.L.slice(), R: sig.R.slice() }; const out = await ev('fx')(dec, P, () => {}); return { L: out.getChannelData(0), R: out.getChannelData(1), n: out.length }; };
for (const rate of [8000, 22050, 44100, 48000, 96000]) for (const k of presetKeys) {
  const r = await S.__run(fromPreset(k), signal(1.2, rate)); ok(finite(r.L) && finite(r.R) && r.n >= Math.round(1.2 * rate), `preset ${k} @${rate}: NaN/Inf hoặc ngắn hơn đầu vào`);
}
const extremes = [{ rv: 'big', mix: 1, decay: 2, revAmt: 1 }, { dly: 'h', dmix: 1, fb: 0.9 }, { dly: 'e16', dmix: 1, fb: 0.9 }, { eq: 'muffled', bassdb: 12, middb: -12, trebdb: 12 }, { eq: 'radio', trebdb: -12 }, { width: 2, kara: 1 }, { width: 0 },
  { rev: 'on', fin: 60, fout: 60 }, { period: 1, pmode: 'circle', panAmt: 1 }, { period: 120, pmode: 'drift', panAmt: 1 }, { pmode: 'circle', panAmt: 1, rear: 1, dist: 1, phase: 345 }, { pmode: 'circle_rev', panAmt: 1, rear: 0, dist: 0.5, phase: 90 }, { pmode: 'circle', panAmt: 1, period: NaN, rear: NaN, dist: NaN, phase: NaN }, { pmode: 'fig8', panAmt: 1 }, { pmode: 'swing_back', panAmt: 1 }, { pmode: 'swing_front', panAmt: 1 }, { pmode: 'circle_rev', panAmt: 1 },
  { pmode: 'lr', panAmt: 1, pshape: 'tri' }, { pmode: 'lr', panAmt: 1, pshape: 'sq' }, { rv: 'dark', mix: 1, dly: 'q', dmix: 1, fb: 0.9, pmode: 'circle', panAmt: 1, eq: 'warm' }, { rv: 'room_s', mix: NaN, decay: NaN, fb: NaN }];
for (const rate of [8000, 16000, 44100, 192000]) for (const e of extremes) { const r = await S.__run({ ...BASE, ...e }, signal(rate > 100000 ? 0.4 : 1, rate, 1)); ok(finite(r.L) && finite(r.R), `cực đoan ${JSON.stringify(e)} @${rate}: NaN/Inf`); }
{ const z = { rate: 44100, L: new Float32Array(44100), R: new Float32Array(44100) }; const r = await S.__run({ ...BASE, rv: 'big', mix: 1, dly: 'q', dmix: 1, pmode: 'circle', panAmt: 1 }, z); ok(finite(r.L) && maxAbs(r.L) === 0, 'im lặng vào → im lặng ra'); }
{ // echo ping-pong: so khớp bản tham chiếu ngây thơ (hai mảng cả bài) — kiểm tra bộ đệm vòng
  const rate = 8000, sig = signal(0.6, rate), P = { ...BASE, dly: 'e16', dmix: 0.7, fb: 0.5 }, r = await S.__run(P, sig);
  const d = Math.round(0.125 * rate), n = sig.L.length, reps = 10, len = n + d * reps, L = new Float32Array(len), R = new Float32Array(len), eL = new Float32Array(len), eR = new Float32Array(len); L.set(sig.L); R.set(sig.R);
  for (let i = d; i < len; i++) { const m = i - d < n ? (sig.L[i - d] + sig.R[i - d]) * 0.5 : 0; eL[i] = m + 0.5 * eR[i - d]; eR[i] = 0.5 * eL[i - d]; L[i] += 0.7 * eL[i]; R[i] += 0.7 * eR[i]; }
  let md = 0; for (let i = 0; i < len; i++) md = Math.max(md, Math.abs(L[i] - r.L[i]), Math.abs(R[i] - r.R[i])); ok(r.n === len && md < 1e-5, `echo lệch bản tham chiếu: len ${r.n}/${len}, maxdiff ${md}`);
}
{ const st = { rate: 44100, L: new Float32Array(4410), R: new Float32Array(4410) }; st.L[0] = 1; st.R[0] = 1; const dec = await ev('fx')({ ...st, L: st.L.slice(), R: st.R.slice() }, { ...BASE, rv: 'hall', mix: 1 }, () => {}); ok(finite(dec.getChannelData(0)), 'xung đơn qua reverb phải hữu hạn'); }
for (const rate of [8000, 11025, 16000, 22050, 44100, 48000, 96000, 192000]) for (const ty of ['lp', 'hp', 'pk', 'ls', 'hs']) for (const f of [20, 400, 3400, 8000, 20000, 90000]) for (const q of [0.1, 0.707, 10]) for (const g of [-30, 0, 12, 30]) {
  const [b0, b1, b2, a1, a2] = S.biquadCoef(ty, f, q, g, rate); ok([b0, b1, b2, a1, a2].every(Number.isFinite) && Math.abs(a2) < 1 && Math.abs(a1) < 1 + a2, `biquad bất ổn ${ty} f=${f} q=${q} g=${g} fs=${rate}`);
}

section('3b. 8D: độ trễ/độ sáng giữa hai tai, chu kỳ, preset, "Chỉnh nhanh"');
{ const rate = 44100, sec = 8000, imp = () => { const n = 6000, L = new Float32Array(n), R = new Float32Array(n); L[2000] = R[2000] = 1; return { rate, L, R }; };
  const peak = a => { let i = 0, m = 0; for (let k = 0; k < a.length; k++) if (Math.abs(a[k]) > m) { m = Math.abs(a[k]); i = k; } return [i, m]; };
  const run8 = async (phase, extra = {}) => { const r = await S.__run({ ...BASE, pmode: 'circle', panAmt: 1, period: 1000, phase, rear: 0, ...extra }, imp()); return { l: peak(r.L), r: peak(r.R) }; };
  const woodworth = (0.0875 / 343) * rate * (Math.PI / 2 + 1);   // ≈ 28.9 mẫu ở 44,1 kHz
  const right = await run8(90), left = await run8(270), front = await run8(0), rear0 = await run8(180), rear1 = await run8(180, { rear: 1 });
  ok(Math.abs((right.l[0] - right.r[0]) - woodworth) < 2.5 && right.r[1] > right.l[1], `nguồn bên phải: tai trái phải trễ ≈ ${woodworth.toFixed(1)} mẫu và nhỏ hơn: ` + JSON.stringify(right));
  ok(Math.abs((left.r[0] - left.l[0]) - woodworth) < 2.5 && left.l[1] > left.r[1], 'nguồn bên trái: đối xứng: ' + JSON.stringify(left));
  ok(Math.abs(front.l[0] - front.r[0]) <= 1 && Math.abs(front.l[1] - front.r[1]) < 0.02, 'nguồn phía trước: hai tai giống nhau: ' + JSON.stringify(front));
  ok(rear1.l[1] < rear0.l[1] * 0.95 && rear1.l[1] < front.l[1], 'tham số rear làm âm phía sau nhỏ/tối hơn: ' + [rear0.l[1], rear1.l[1], front.l[1]]);
  const dist = await run8(0, { dist: 1 }); ok(dist.l[1] < front.l[1] * 0.7, 'tham số dist làm nguồn xa nhỏ hơn: ' + [dist.l[1], front.l[1]]);
  // chu kỳ: nhiễu trắng; nguồn quay 1 vòng / 2 giây ở 8 kHz — nghiêng phải ở 1/4 chu kỳ, nghiêng trái ở 3/4 chu kỳ, lặp lại sau đúng một chu kỳ
  const r8 = 8000, n = r8 * 8, noise = () => { const L = new Float32Array(n), R = new Float32Array(n); for (let i = 0; i < n; i++) L[i] = R[i] = rnd() - 0.5; return { rate: r8, L, R }; };
  const rms = (a, t) => { let e = 0, c = 0; for (let i = Math.round(t * r8); i < Math.round((t + 0.1) * r8); i++) { e += a[i] * a[i]; c++; } return Math.sqrt(e / c); };
  for (const [kind, sign] of [['circle', 1], ['circle_rev', -1]]) { const o = await S.__run({ ...BASE, pmode: kind, panAmt: 1, period: 2, rear: 0 }, noise()), ratio = t => rms(o.R, t) / rms(o.L, t);
    ok(sign * Math.log(ratio(0.45)) > 0.15 && sign * Math.log(ratio(1.45)) < -0.15 && Math.abs(Math.log(ratio(0.45) / ratio(2.45))) < 0.12, `${kind}: nghiêng đúng chiều và lặp lại sau 1 chu kỳ: ` + [0.45, 1.45, 2.45].map(ratio).map(x => x.toFixed(2))); }
}
{ const P_ = ev('PRESETS'), grp = ev('PGROUPS').flatMap(g => g[1]), PTt = ctxI.PT;
  for (const k of Object.keys(P_)) { ok(grp.filter(x => x === k).length === 1, 'preset không nằm đúng 1 nhóm: ' + k); ok(PTt[k] && PTt[k].length === 4 && PTt[k].every(Boolean), 'thiếu bản dịch zh/en cho preset ' + k); }
  ok(ev(`JSON.stringify(quickIds({pmode:'circle',period:8,panAmt:100,rv:'room',mix:15}))`) === '["period","panAmt","mix"]' && ev('quickIds({}).length') === 0 && ev(`quickIds({period:1,panAmt:1,speed:1,semis:1,mix:1,dist:1,rear:1}).length`) === 5, 'quickIds sai');
  for (const k of ['c8d', 'c8d_hall', 'c8d_close', 'c8d_far', 'c8d_bass', 'slowed', 'nightcore']) ok(ev(`quickIds(PRESETS['${k}'][1]).length`) >= 2, 'preset ' + k + ' cần ít nhất 2 núm chỉnh nhanh');
  const F_ = ev('FORMATS'), fg = ev('FGROUPS').flatMap(g => g[1]); for (const k of Object.keys(F_)) { ok(fg.filter(x => x === k).length === 1, 'định dạng không nằm đúng 1 nhóm: ' + k); ok(F_[k].need && F_[k].need.enc.length && F_[k].need.mux, 'định dạng thiếu need: ' + k); }
  // phát hiện năng lực: phân tích đúng đầu ra thật của ffmpeg (cùng cú pháp với ffmpeg.wasm)
  if (hasFF2()) { const enc = cp.execFileSync('ffmpeg', ['-hide_banner', '-encoders']).toString().split('\n'), mux = cp.execFileSync('ffmpeg', ['-hide_banner', '-muxers']).toString().split('\n'), E = new Set(), M = new Set();
    for (const l of enc) { const m = l.match(/^\s*[VAS][.\w]{5}\s+(\S+)/); if (m) E.add(m[1]); } for (const l of mux) { const m = l.match(/^\s*[D ]?E\s+([\w,.-]+)/); if (m) m[1].split(',').forEach(x => M.add(x)); }
    const all = Object.entries(F_).filter(([k]) => !['wma'].includes(k)); ok(E.has('aac') && E.has('flac') && M.has('ipod') && M.has('matroska') && M.has('wv'), 'đọc danh sách encoder/muxer thật'); for (const [k, F] of all) ok(F.need.enc.every(e => E.has(e)) && M.has(F.need.mux), `${k}: encoder/muxer ${F.need.enc}/${F.need.mux} có trong ffmpeg gốc`); }
}
section('3c. MAX dB (maximizer): độ to khớp ffmpeg ebur128, đỉnh không vượt trần, nhạc nhỏ → to, các trường hợp biên');
{
  const mk = (sec, rate, amp, crest = 0) => { const n = Math.round(sec * rate), L = new Float32Array(n), R = new Float32Array(n);
    for (let i = 0; i < n; i++) { const env = 0.55 + 0.45 * Math.sin(2 * Math.PI * 0.5 * i / rate), tr = crest && i % Math.round(0.4 * rate) < 30 ? crest : 0;   // nhạc có động + "trống" thưa
      L[i] = amp * env * (Math.sin(2 * Math.PI * 220 * i / rate) + 0.5 * Math.sin(2 * Math.PI * 1500 * i / rate)) + tr * amp + (rnd() - 0.5) * amp * 0.05;
      R[i] = amp * env * (Math.sin(2 * Math.PI * 330 * i / rate) + 0.4 * Math.sin(2 * Math.PI * 2100 * i / rate)) + tr * amp + (rnd() - 0.5) * amp * 0.05; }
    return { rate, L, R }; };
  const lufsOf = async (sig) => { const m = await ev('measureLoud')(sig.L, sig.R, sig.rate); return m.lufs; };
  const db = x => 20 * Math.log10(x);
  const run = async (sig, amt, ceil = -1) => { const L = sig.L.slice(), R = sig.R.slice(), info = await ev('maximize')(L, R, sig.rate, amt, ceil); return { L, R, info, rate: sig.rate }; };
  for (const rate of [8000, 22050, 44100, 48000, 96000]) {
    const sig = mk(3, rate, 0.04, 6), before = await lufsOf(sig), o = await run(sig, 1), after = await lufsOf(o);
    const pk = Math.max(maxAbs(o.L), maxAbs(o.R)), ceil = Math.pow(10, -1 / 20);
    ok(finite(o.L) && finite(o.R), `MAX dB @${rate}: NaN/Inf`);
    ok(pk <= ceil * (1 + 1e-6), `MAX dB @${rate}: đỉnh ${pk} vượt trần ${ceil}`);
    ok(after - before > 12, `MAX dB @${rate}: nhạc nhỏ phải to lên > 12 dB (được ${(after - before).toFixed(1)})`);
    ok(after > -15 && after < -5, `MAX dB @${rate}: LUFS đầu ra hợp lý (${after.toFixed(1)})`);
    const mus = mk(3, rate, 0.04, 0), mb = await lufsOf(mus), mo = await run(mus, 1), ma = await lufsOf(mo);   // nhạc ít đỉnh nhọn: phải lên sát mục tiêu
    ok(ma > -9 && ma < -5.5 && ma - mb > 12, `MAX dB @${rate}: nhạc nhỏ thường → ${mb.toFixed(1)} → ${ma.toFixed(1)} LUFS`);
  }
  // mức 0% = tắt; mức thấp hơn thì nhỏ hơn mức cao hơn
  { const sig = mk(2, 44100, 0.05, 4), a = await run(sig, 0), b = await run(sig, 0.4), c = await run(sig, 1);
    ok(a.info === null && a.L.every((v, i) => v === sig.L[i]), 'MAX dB 0% không đụng vào âm thanh');
    ok(await lufsOf(b) < await lufsOf(c) - 1, 'MAX dB: 40% nhỏ hơn 100% ít nhất 1 LU'); }
  // đỉnh không vượt trần với mọi trần, kể cả nhạc đã rất to và nhiều đỉnh nhọn
  for (const cd of [-6, -3, -1, -0.1]) { const sig = mk(2, 44100, 0.9, 3), o = await run(sig, 1, cd), pk = Math.max(maxAbs(o.L), maxAbs(o.R)); ok(pk <= Math.pow(10, cd / 20) * (1 + 1e-6), `MAX dB trần ${cd} dBFS: đỉnh ${db(pk).toFixed(3)}`); }
  // nhạc đã to: không bị làm nhỏ đi, không vỡ
  { const sig = mk(2, 44100, 0.5, 0), before = await lufsOf(sig), o = await run(sig, 1), after = await lufsOf(o); ok(after >= before - 0.5, `MAX dB không làm nhạc to nhỏ đi (${before.toFixed(1)} → ${after.toFixed(1)})`); }
  // biên: im lặng, rất ngắn, 1 mẫu, rỗng, hằng số
  { const z = { rate: 44100, L: new Float32Array(44100), R: new Float32Array(44100) }, o = await run(z, 1); ok(o.info === null && maxAbs(o.L) === 0, 'MAX dB: im lặng → im lặng'); }
  for (const n of [0, 1, 7, 100, 3000]) { const sig = { rate: 44100, L: new Float32Array(n).fill(0.01), R: new Float32Array(n).fill(-0.01) }; if (n > 2) for (let i = 0; i < n; i += 5) sig.L[i] = 0.02; const o = await run(sig, 1); ok(finite(o.L) && finite(o.R) && maxAbs(o.L) <= 0.8913, `MAX dB: ${n} mẫu`); }
  // độ to đo bằng JS khớp ffmpeg ebur128 (sai số ≤ 0,3 LU) trên tín hiệu thật
  if (hasFF2()) {
    const sig = mk(6, 48000, 0.2, 3), mine = await lufsOf(sig), wav = await ev('toWavF32')({ length: sig.L.length, sampleRate: 48000, getChannelData: c => c ? sig.R : sig.L }, 0, 'down'), f = path.join(os.tmpdir(), 'sway-max-' + process.pid + '.wav');
    fs.writeFileSync(f, wav); const out = cp.spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' }).stderr; fs.unlinkSync(f);
    const m = [...out.matchAll(/\n\s*I:\s+(-?[\d.]+) LUFS/g)].pop(); ok(m && Math.abs(+m[1] - mine) <= 0.3, `độ to JS ${mine.toFixed(2)} LUFS khớp ffmpeg ebur128 ${m && m[1]}`);
  }
  // preset MAX dB 8D: 8D + reverb + MAX dB chạy cuối chuỗi → nhạc nhỏ to lên, đỉnh không vượt trần, vẫn xoay 8D (hai kênh khác nhau theo thời gian)
  for (const rate of [22050, 44100, 48000]) { const sig = mk(4, rate, 0.04, 0), before = await lufsOf(sig), o = await S.__run(fromPreset('maxdb_8d'), sig), after = await lufsOf({ L: o.L, R: o.R, rate }), pk = Math.max(maxAbs(o.L), maxAbs(o.R));
    ok(finite(o.L) && finite(o.R) && pk <= Math.pow(10, -1 / 20) * (1 + 1e-6), `maxdb_8d @${rate}: đỉnh ${pk}`); ok(after - before > 10 && after > -11, `maxdb_8d @${rate}: ${before.toFixed(1)} → ${after.toFixed(1)} LUFS`);
    // chuyển động 8D còn nguyên sau MAX dB: tín hiệu giống nhau ở hai kênh → 8D làm tỉ lệ L/R xoay rõ; limiter liên kết stereo KHÔNG được làm phẳng nó
    const mono = { rate, L: sig.L, R: sig.L }, on = await S.__run(fromPreset('maxdb_8d'), mono), off = await S.__run({ ...fromPreset('maxdb_8d'), maxdb: 0 }, mono);
    const rms = (a, t) => { let e = 0, c = 0; for (let i = Math.round(t * rate); i < Math.round((t + 0.1) * rate); i++) { e += a[i] * a[i]; c++; } return Math.sqrt(e / c); };
    const sw = x => { const v = [0.5, 1, 1.5, 2, 2.5, 3, 3.5].map(t => Math.log(rms(x.L, t) / rms(x.R, t))); return Math.max(...v) - Math.min(...v); }, swOn = sw(on), swOff = sw(off);
    ok(swOn > 0.3 && Math.abs(swOn - swOff) < 0.1, `maxdb_8d @${rate}: vẫn xoay 8D (biên độ L/R ${swOn.toFixed(2)} so với ${swOff.toFixed(2)} khi tắt MAX dB)`); }
  // qua getP/preset thật: preset maxdb ghi đúng thông số
  { const P = fromPreset('maxdb'); ok(P.maxdb === 1 && P.comp === 'soft', 'preset maxdb: maxdb=100% và comp=soft'); ok(ev(`JSON.stringify(quickIds(PRESETS['maxdb'][1]))`) === '["maxdb","mix"]', 'preset maxdb: núm chỉnh nhanh MAX dB + mức reverb');
    for (const k of ['maxdb', 'maxdb_8d']) { const q = fromPreset(k); ok(q.rv && q.rv !== 'off' && q.mix > 0 && q.maxdb === 1, `preset ${k}: phải có reverb (rv=${q.rv}, mix=${q.mix}) và MAX dB 100%`); } }
}

section('4. WAV / định dạng / lọc / tên file / ZIP');
{ const sig = signal(0.5, 44100, 0.25); sig.L[10] = NaN; sig.R[11] = Infinity;
  const out = { length: sig.L.length, sampleRate: 44100, getChannelData: c => c ? sig.R : sig.L }, wav = await S.toWavF32(out, -1, 'both', () => {}), back = S.parseWav(wav);
  ok(back.rate === 44100 && back.L.length === sig.L.length, 'parseWav(toWavF32) sai độ dài/tần số'); ok(finite(back.L) && back.L[10] === 0 && back.R[11] === 0, 'NaN/Inf phải thành 0');
  let pk = 0; for (const a of [back.L, back.R]) for (const v of a) pk = Math.max(pk, Math.abs(v)); ok(Math.abs(pk - Math.pow(10, -1 / 20)) < 1e-3, 'chuẩn hóa đỉnh về −1 dBFS sai: ' + pk);
  const down = S.parseWav(await S.toWavF32(out, 0, 'down', () => {})); let p2 = 0; for (const v of down.L) p2 = Math.max(p2, Math.abs(v)); ok(Math.abs(p2 - 0.25 / 0.25 * 0.25) < 0.3 && p2 <= 1, "norm 'down' không được nâng mức");
  const w2 = wav.slice(); w2[0] = 0; let threw = 0; try { S.parseWav(w2); } catch (e) { threw = e.key === 'wavE'; } ok(threw, 'WAV hỏng phải ném UserError(wavE)');
  const sz = wav.slice(); new DataView(sz.buffer).setUint32(40, 0xFFFFFFFF, true); ok(S.parseWav(sz).L.length === sig.L.length, 'size data = 0xFFFFFFFF phải đọc theo độ dài thật');
  const lst = new Uint8Array(wav.length + 18); lst.set(wav.subarray(0, 36)); lst.set(new TextEncoder().encode('LIST'), 36); new DataView(lst.buffer).setUint32(40, 10, true); lst.set(wav.subarray(36), 54); const lw = S.parseWav(lst); ok(lw.L.length === sig.L.length, 'chunk LIST trước data phải được bỏ qua'); }
const baseP = { sr: '44100', kbps: 192, vbr: 'off', ch: 2, depth: 16, meta: [], lufs: 0 };
ok(ev(`outRate(FORMATS.ac3, {sr:'orig'}, 22050)`) === 32000 && ev(`outRate(FORMATS.aac, {sr:'orig'}, 192000)`) === 96000 && ev(`outRate(FORMATS.mp3, {sr:'96000'}, 44100)`) === 48000 && ev(`outRate(FORMATS.opus, {sr:'44100'}, 44100)`) === 48000, 'outRate không khớp bộ mã hóa');
{ const f = ev(`decodeFilterList({speed:NaN,semis:1e9,ts:1e21,te:-5,hp:1e9,lp:-4,dn:1e9,gain:1e9,sil:'both',spdm:'pitch',chm:'swap',comp:'mid',fxm:'chorus'}, 44100).join(',')`); ok(!/NaN|undefined|e\+|Infinity/.test(f), 'bộ lọc có giá trị bất thường: ' + f); }
ok(JSON.stringify(ev(`syncRisk({speed:0.8,ts:0,te:0,sil:'off',rev:'off',pair:false})`)) === '["rsSpeed"]' && ev(`syncRisk({speed:1,ts:5,te:0,sil:'start',rev:'on',pair:true,none:false})`).length === 4 && ev(`syncRisk({speed:1,ts:0,te:0,sil:'off',rev:'off',pair:false,none:true})`).length === 0 && ev(`hasTail({rv:'hall',mix:0.2,dly:'off',dmix:0})`) === true, 'syncRisk/hasTail sai');
{ const U = e => ev(`fileSafe(${JSON.stringify(e[0])}, ${JSON.stringify(e[1])})`);
  ok(!/[\\/:*?"<>|\u0000-\u001f]/.test(U(['..\\..\\evil/../x:y*z?.mp3', 'flac'])) && U(['', 'mp3']) === 'audio.mp3' && U(['...', 'mp3']) === 'audio.mp3', 'fileSafe không làm sạch tên');
  const long = U(['歌'.repeat(200) + '-sway', 'flac']); ok(new TextEncoder().encode(long).length <= 180 && long.endsWith('.flac'), 'fileSafe không cắt theo byte UTF-8: ' + new TextEncoder().encode(long).length);
  ok(U(['Tiêu đề 标题 🎵', 'mp3']) === 'Tiêu đề 标题 🎵.mp3', 'tên Unicode phải giữ nguyên');
  const names = ev(`(() => { const u = new Set(); return ['A.mp3','a.mp3','A.MP3','b.flac','b.flac'].map(n => uniqueName(n, u)); })()`); ok(new Set(names.map(n => n.toLowerCase())).size === 5, 'uniqueName không khử trùng không phân biệt hoa/thường: ' + names); }
ok(await ev('crc32Blob')(new S.Blob([new TextEncoder().encode('123456789')])) === 0xCBF43926, 'CRC32 sai vector chuẩn');
{ const b = new S.Blob([new Uint8Array(nc.randomBytes(9 << 20))]); const all = new Uint8Array(await b.arrayBuffer()); ok(await ev('crc32Blob')(b) === zlib.crc32(all), 'crc32Blob ≠ zlib.crc32'); }
{ const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sway-zip-')), items = [['Bản nhạc 标题 🎵.flac', 3000], ['Bản nhạc 标题 🎵.flac', 10], ['b.mp3', 0], ['c.wav', 70000]].map(([n, s]) => ({ n, data: new Uint8Array(nc.randomBytes(s)) }));
  const used = ev('new Set()'), list = []; for (const it of items) list.push({ name: ev('uniqueName')(it.n, used), blob: new S.Blob([it.data]), crc: zlib.crc32(it.data), size: it.data.length });
  const zb = await ev('zipStore')(list, () => {}); fs.writeFileSync(path.join(tmp, 't.zip'), Buffer.from(await zb.arrayBuffer()));
  const py = `import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print('|'.join(i.filename+':'+str(i.file_size) for i in z.infolist()))`;
  try { const o = cp.execFileSync('python3', ['-c', py, path.join(tmp, 't.zip')]).toString().trim(); ok(o === 'Bản nhạc 标题 🎵.flac:3000|Bản nhạc 标题 🎵 (1).flac:10|b.mp3:0|c.wav:70000', 'ZIP giải nén sai: ' + o); } catch (e) { ok(false, 'Python zipfile từ chối ZIP: ' + e.message.split('\n')[0]); } }

section('5. Pipeline thật với ffmpeg gốc (giải mã → hiệu ứng → WAV → mã hóa → ffprobe)');
function hasFF2() { try { cp.execFileSync('ffmpeg', ['-version'], { stdio: 'pipe' }); return true; } catch (_) { return false; } }
const hasFF = (() => { try { cp.execFileSync('ffmpeg', ['-version'], { stdio: 'pipe' }); return true; } catch (_) { return false; } })();
if (!hasFF) console.log('  (bỏ qua: không có ffmpeg trong PATH)');
else {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sway-ff-')), media = path.join(tmp, 'media'); fs.mkdirSync(media);
  const mk = a => cp.execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a], { cwd: media });
  mk(['-f', 'lavfi', '-i', 'color=c=0x14213d:s=300x300:d=1', '-frames:v', '1', 'cover.jpg']);
  mk(['-f', 'lavfi', '-i', 'sine=f=440:d=3', '-i', 'cover.jpg', '-map', '0:a', '-map', '1:v', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '128k', '-c:v', 'copy', '-id3v2_version', '3', '-metadata', 'title=Tiêu đề 标题', '-metadata', 'artist=Nghệ sĩ', '-metadata', 'album=Alb', '-metadata', 'track=3/12', '-disposition:v:0', 'attached_pic', 'cover.mp3']);
  mk(['-f', 'lavfi', '-i', 'sine=f=300:d=2:r=8000', '-ac', '1', 'mono8k.wav']); mk(['-f', 'lavfi', '-i', 'sine=f=500:d=2:r=192000', '-c:a', 'flac', '-sample_fmt', 's32', 'hires.flac']);
  mk(['-f', 'lavfi', '-i', 'testsrc=d=3:s=160x120:r=15', '-f', 'lavfi', '-i', 'sine=f=440:d=3', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', 'video.mp4']);
  mk(['-f', 'lavfi', '-i', 'testsrc=d=1:s=64x64:r=5', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', 'noaudio.mp4']); fs.writeFileSync(path.join(media, 'garbage.mp3'), new Uint8Array(nc.randomBytes(5000)));
  // ffmpeg giả: cùng giao diện với ffmpeg.wasm (writeFile/readFile/deleteFile/listDir/exec/on/off) nhưng chạy ffmpeg gốc trong thư mục tạm
  let work; const handlers = {};
  const fake = {
    writeFile: async (n, d) => fs.writeFileSync(path.join(work, n), d), readFile: async n => new Uint8Array(fs.readFileSync(path.join(work, n))), deleteFile: async n => fs.unlinkSync(path.join(work, n)),
    listDir: async () => fs.readdirSync(work).map(name => ({ name, isDir: false })), on: (e, f) => (handlers[e] ||= []).push(f), off: (e, f) => { handlers[e] = (handlers[e] || []).filter(x => x !== f); }, terminate() {},
    exec: async args => { const r = cp.spawnSync('ffmpeg', ['-nostdin', '-y', ...args], { cwd: work, maxBuffer: 1 << 28 }); for (const l of r.stderr.toString().split(/\r?\n/)) (handlers.log || []).forEach(f => f({ type: 'stderr', message: l })); return r.status; },
  };
  const probe = f => JSON.parse(cp.execFileSync('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', f]).toString());
  const run = async (input, P, { video = false, ext, secs = 0, seek = 0 } = {}) => {
    work = fs.mkdtempSync(path.join(tmp, 'w-')); ev('ff = null'); S.__fake = fake; ev('ff = __fake');
    const file = { size: fs.statSync(path.join(media, input)).size, arrayBuffer: async () => fs.readFileSync(path.join(media, input)).buffer.slice(0) };
    const dec = await ev('decode')(file, P, secs, 0, null, seek), rate = dec.rate, cov = dec.cover, dur = dec.L.length / rate;
    const out = await ev('fx')(dec, P, () => {}), wav = await ev('toWavF32')(out, P.none ? 0 : -1, 'down', () => {});
    await fake.writeFile('fx.wav', wav); if (P.coverData) await fake.writeFile('cover.img', P.coverData);
    const rc = await fake.exec(ev('buildArgs')({ ...P, srcCover: cov }, rate)); return { rc, work, ext, dur, rate, cov, outLen: out.length / rate };
  };
  const P0 = { ...BASE, none: true, sr: 'orig', kbps: 192, vbr: 'off', ch: 2, depth: 16, meta: [], lufs: 0, cmode: 'keep', cover: false, strip: false, trauto: false, peak: -1, norm: 'down', speed: 1, spdm: 'pitch', semis: 0, sil: 'off', ts: 0, te: 0, hp: 0, lp: 0, dn: 0, gain: 0, comp: 'off', fxm: 'off', chm: 'off', idx: 1, cnt: 1 };
  console.log('  formats:', Object.keys(ev('FORMATS')).join(' '));
  for (const fmt of Object.keys(ev('FORMATS'))) {
    const F = ev(`FORMATS.${fmt}`), r = await run(F.video ? 'video.mp4' : 'cover.mp3', { ...P0, fmt, meta: [['comment', 'ghi chú 注释']] }); ok(r.rc === 0, fmt + ': ffmpeg trả mã lỗi ' + r.rc);
    const o = path.join(r.work, 'out.' + F.ext); if (!fs.existsSync(o)) { ok(false, fmt + ': không có file đầu ra'); continue; }
    const pr = probe(o), a = pr.streams.find(s => s.codec_type === 'audio'); ok(!!a && Math.abs(+pr.format.duration - 3) < 0.35, `${fmt}: thời lượng ${pr.format.duration}`);
    if (ev('COVER_FMT').includes(fmt)) { ok(pr.streams.some(s => s.codec_type === 'video'), fmt + ': mất ảnh bìa gốc'); const t = pr.format.tags || {}; ok(Object.values(t).some(v => String(v).includes('标题')) || fmt === 'wav', fmt + ': mất tag Unicode'); }
    if (F.video) ok(pr.streams.some(s => s.codec_type === 'video' && s.codec_name === 'h264'), fmt + ': mất hình gốc');
  }
  for (const fmt of Object.keys(ev('FORMATS')).filter(k => ev(`FORMATS.${k}.depth`) && ev(`FORMATS.${k}.depth`).includes(24))) { const F = ev(`FORMATS.${fmt}`), r = await run(F.video ? 'video.mp4' : 'cover.mp3', { ...P0, fmt, depth: 24 }); const a = probe(path.join(r.work, 'out.' + F.ext)).streams.find(x => x.codec_type === 'audio'); ok(r.rc === 0 && +(a.bits_per_raw_sample || a.bits_per_sample) >= 24, `${fmt}: 24-bit phải ra 24-bit, nhận ` + (a && (a.bits_per_raw_sample + '/' + a.bits_per_sample))); }
  { const r = await run('mono8k.wav', { ...P0, fmt: 'mp3', sr: 'orig' }); ok(r.rc === 0 && r.rate === 8000, 'mono 8 kHz → mp3'); const r2 = await run('hires.flac', { ...P0, fmt: 'aac', sr: 'orig' }); ok(r2.rc === 0 && r2.rate === 192000 && probe(path.join(r2.work, 'out.m4a')).streams.find(s => s.codec_type === 'audio').sample_rate === '96000', '192 kHz → aac (96 kHz)'); const r3 = await run('mono8k.wav', { ...P0, fmt: 'ac3', sr: 'orig' }); ok(r3.rc === 0, 'ac3 từ nguồn 8 kHz (snap 32 kHz)'); }
  { const r = await run('cover.mp3', { ...P0, fmt: 'mp3', cover: true, coverData: new Uint8Array(fs.readFileSync(path.join(media, 'cover.jpg'))) }); ok(r.rc === 0 && probe(path.join(r.work, 'out.mp3')).streams.some(s => s.codec_type === 'video'), 'ảnh bìa thay thế'); const r2 = await run('cover.mp3', { ...P0, fmt: 'flac', strip: true }); const pr2 = probe(path.join(r2.work, 'out.flac')); ok(r2.rc === 0 && !pr2.streams.some(s => s.codec_type === 'video') && !(pr2.format.tags && pr2.format.tags.title), 'xóa metadata phải xóa cả tag lẫn bìa'); }
  { // preset thật (slowed + reverb, nightcore, 8D) qua giải mã MỘT lượt + hiệu ứng
    for (const k of ['slowed', 'nightcore', 'c8d', 'pingpong', 'podcast', 'maxdb', 'maxdb_8d']) { const raw = ev(`PRESETS['${k}'][1]`), P = { ...P0, none: false, fmt: 'flac' }; for (const [a, v] of Object.entries(raw)) P[a] = PCT.includes(a) ? v / 100 : v; if (k === 'podcast') { P.dn = raw.dn || 0; } const r = await run('cover.mp3', P); ok(r.rc === 0 && r.outLen > 1, 'preset ' + k + ' qua ffmpeg thật'); }
    { // MAX dB thật: nhạc rất nhỏ (≈ -39 LUFS) → FLAC; đo bằng ebur128 + volumedetect của ffmpeg gốc
      cp.execFileSync('ffmpeg', ['-nostdin', '-y', '-f', 'lavfi', '-i', 'sine=f=220:d=4', '-f', 'lavfi', '-i', 'sine=f=330:d=4', '-f', 'lavfi', '-i', 'sine=f=1800:d=4', '-filter_complex', '[0][1][2]amix=inputs=3:normalize=0,tremolo=f=3:d=0.6,volume=-20dB,aformat=channel_layouts=stereo', path.join(media, 'quiet.wav')], { stdio: 'pipe' });
      const P = { ...P0, none: false, fmt: 'flac', depth: 24, comp: 'soft', maxdb: 1, pmode: 'off' }, r = await run('quiet.wav', P), o = path.join(r.work, 'out.flac');
      const meas = f => { const t = cp.spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=peak=true,volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr, I = [...t.matchAll(/\n\s*I:\s+(-?[\d.]+) LUFS/g)].pop(), M = t.match(/max_volume: (-?[\d.]+) dB/); const T = t.match(/True peak:\s+Peak:\s+(-?[\d.]+) dBFS/); return { lufs: +I[1], max: +M[1], tp: T ? +T[1] : NaN }; };
      const before = meas(path.join(media, 'quiet.wav')), after = meas(o);
      ok(r.rc === 0 && after.lufs - before.lufs > 18, `MAX dB thật: nhạc nhỏ phải to lên > 18 LU (${before.lufs} → ${after.lufs})`);
      ok(after.max <= -0.9 && after.max >= -1.6, `MAX dB thật: đỉnh sát trần -1 dBFS (${after.max} dB)`);
      ok(after.tp <= -0.85 && after.tp >= -1.6, `MAX dB thật: ĐỈNH THẬT sát trần -1 dBTP (${after.tp})`);
      // tín hiệu có đỉnh nội suy cao hơn đỉnh mẫu ~3 dB (sin fs/4 lệch pha 45°): limiter chỉ dò đỉnh mẫu sẽ vượt +2 dBTP
      cp.execFileSync('ffmpeg', ['-nostdin', '-y', '-f', 'lavfi', '-i', 'aevalsrc=0.02*sin(2*PI*220*t)+0.02*sin(2*PI*11025*t+PI/4):s=44100:d=4:c=stereo', path.join(media, 'isp.wav')], { stdio: 'pipe' });
      { const r2 = await run('isp.wav', P), a2 = meas(path.join(r2.work, 'out.flac')); ok(r2.rc === 0 && a2.tp <= -0.8, `MAX dB: đỉnh nội suy (ISP) vẫn ≤ -1 dBTP (${a2.tp}; đỉnh mẫu ${a2.max})`); }
      // định dạng nén (MP3/AAC...): chừa thêm 1 dB → đỉnh thật ≤ -2 dBTP trước khi mã hóa
      { const r3 = await run('quiet.wav', { ...P, fmt: 'mp3', depth: 16 }), a3 = meas(path.join(r3.work, 'out.mp3')); ok(r3.rc === 0 && a3.tp <= -1.0, `MAX dB xuất MP3: đỉnh thật sau mã hóa ≤ -1 dBTP, không clip (${a3.tp})`); }
      // preset MAX dB 8D DISTRIBUTION qua ffmpeg thật
      { const PM = { ...P0, none: false, fmt: 'flac', depth: 24 }; for (const [k, v] of Object.entries(ev("PRESETS['maxdb'][1]"))) PM[k] = PCT.includes(k) ? v / 100 : v;   // preset MAX dB thật (có reverb phòng nhẹ)
        const r5 = await run('quiet.wav', PM), a5 = meas(path.join(r5.work, 'out.flac')); ok(r5.rc === 0 && a5.lufs - before.lufs > 18 && a5.tp <= -0.85, `MAX dB (có reverb) thật: ${before.lufs} → ${a5.lufs} LUFS, đỉnh thật ${a5.tp} dBTP`); console.log(`  MAX dB preset (reverb): → ${a5.lufs} LUFS, TP ${a5.tp}`); }
      { const P8 = { ...P0, none: false, fmt: 'flac', depth: 24 }; for (const [k, v] of Object.entries(ev("PRESETS['maxdb_8d'][1]"))) P8[k] = PCT.includes(k) ? v / 100 : v;
        const r4 = await run('quiet.wav', P8), a4 = meas(path.join(r4.work, 'out.flac')); ok(r4.rc === 0 && a4.lufs - before.lufs > 18 && a4.tp <= -0.85, `MAX dB 8D DISTRIBUTION thật: ${before.lufs} → ${a4.lufs} LUFS, đỉnh thật ${a4.tp} dBTP`); console.log(`  MAX dB 8D: ${before.lufs} → ${a4.lufs} LUFS, TP ${a4.tp}; MAX dB: → ${after.lufs} LUFS, TP ${after.tp}`); }
    }
    const sl = await run('cover.mp3', { ...P0, none: false, fmt: 'flac', speed: 0.8, spdm: 'pitch' }); ok(Math.abs(sl.dur - 3.03 / 0.8) < 0.1, 'speed 0.8 phải dài ra ~1.25×: ' + sl.dur);
    const tr = await run('cover.mp3', { ...P0, fmt: 'flac', ts: 1, te: 2.5 }); ok(Math.abs(tr.dur - 1.5) < 0.05, 'trim 1→2.5 s phải còn 1.5 s: ' + tr.dur);
    const pv = await run('cover.mp3', { ...P0, fmt: 'flac', ts: 1 }, { secs: 1 }); ok(Math.abs(pv.dur - 1) < 0.05, 'nghe thử có trim: -t giới hạn đầu ra sau cắt: ' + pv.dur);
    const rs = await run('cover.mp3', { ...P0, fmt: 'flac' }, { secs: 0 }); const w44 = await (async () => { work = fs.mkdtempSync(path.join(tmp, 'w-')); ev('ff = __fake'); const f = { size: 1, arrayBuffer: async () => fs.readFileSync(path.join(media, 'hires.flac')).buffer.slice(0) }; return ev('decode')(f, P0, 0, 48000, null); })(); ok(w44.rate === 48000 && Math.abs(w44.L.length / 48000 - 2) < 0.02, 'ép sample rate khi giải mã (nghe thử / ghép cặp)'); void rs; }
  mk(['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', '2', 'silent.wav']);
  for (const [name, input, over] of [['cắt vượt độ dài', 'cover.mp3', { ts: 100 }], ['bỏ khoảng lặng cả file im lặng', 'silent.wav', { sil: 'both' }]]) { let key = ''; try { await run(input, { ...P0, fmt: 'flac', ...over }); } catch (e) { key = e.key; } ok(key === 'noAudio' || key === 'fltE', name + ' phải báo lỗi rõ (noAudio/fltE), nhận: ' + (key || 'không lỗi')); console.log('  ' + name + ' →', key); }
  { const sk = await run('cover.mp3', { ...P0, fmt: 'flac' }, { secs: 1, seek: 1.5 }); ok(Math.abs(sk.dur - 1) < 0.05, 'nghe thử từ giây thứ 1,5: dài 1 s: ' + sk.dur); let key = ''; try { await run('cover.mp3', { ...P0, fmt: 'flac' }, { secs: 1, seek: 100 }); } catch (e) { key = e.key; } ok(key === 'noAudio', 'nghe thử từ quá cuối file → noAudio: ' + key); }
  { // ma trận bitrate × kênh cho mọi định dạng nén: không tổ hợp nào được làm ffmpeg thất bại
    const tmpM = fs.mkdtempSync(path.join(tmp, 'mx-')); cp.execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=f=440:d=1', '-ac', '2', '-c:a', 'pcm_f32le', path.join(tmpM, 'fx.wav')]); fs.copyFileSync(path.join(tmpM, 'fx.wav'), path.join(tmpM, 'in'));
    const badM = []; for (const fmt of Object.keys(ev('FORMATS')).filter(k => ev(`FORMATS.${k}.lossy`))) for (const kb of [128, 192, 256, 320]) for (const ch of [1, 2]) { const a = ev('buildArgs')({ ...P0, fmt, kbps: kb, ch, srcCover: null }, 44100), r = cp.spawnSync('ffmpeg', ['-nostdin', '-y', ...a], { cwd: tmpM }); if (r.status !== 0) badM.push(`${fmt} ${kb}k ch${ch}`); }
    ok(badM.length === 0, 'tổ hợp bitrate/kênh thất bại: ' + badM.join(', ')); ok(ev(`buildArgs({ fmt: 'ogg', sr: '44100', kbps: 320, vbr: 'off', ch: 1, depth: 16, meta: [], lufs: 0, cmode: 'keep', srcCover: null }, 44100).join(' ')`).includes('-b:a 240k'), 'ogg mono phải kẹp bitrate về 240k'); }
  for (const bad of ['garbage.mp3', 'noaudio.mp4']) { let key = ''; try { await run(bad, { ...P0, fmt: 'flac' }); } catch (e) { key = e.key; } ok(key === 'decE', bad + ' phải báo decE, nhận: ' + key); }
  { const files = ['cover.mp3', 'mono8k.wav', 'hires.flac', 'video.mp4']; for (const f of files) { work = fs.mkdtempSync(path.join(tmp, 'w-')); fs.copyFileSync(path.join(media, f), path.join(work, 'in')); const lines = []; const cap = m => lines.push(m.message); fake.on('log', cap); await fake.exec(['-i', 'in']); fake.off('log', cap); const i = ev('parseProbe')(lines); ok(i.ok && i.hasAudio && i.rate > 0 && i.dur > 1, `parseProbe ${f}: ` + JSON.stringify(i)); if (f === 'cover.mp3') ok(i.cover === 1, 'parseProbe: chỉ số ảnh bìa'); if (f === 'video.mp4') ok(i.hasVideo, 'parseProbe: hasVideo'); } }
}
console.log(`\n${pass} đạt, ${fail} lỗi`); process.exit(fail ? 1 : 0);
