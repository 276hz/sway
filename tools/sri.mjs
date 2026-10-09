#!/usr/bin/env node
// Sway: in ra khối `sri` để dán vào js/config.js (cần mạng). Khi có SRI, trình duyệt sẽ từ chối bản ffmpeg bị CDN thay đổi.
//   node tools/sri.mjs        → dùng phiên bản và CDN trong js/config.js
import fs from 'node:fs'; import vm from 'node:vm'; import crypto from 'node:crypto'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const cfg = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../js/config.js'), 'utf8'), ctx = {}; vm.createContext(ctx); vm.runInContext(cfg + ';this.SWAY = SWAY;', ctx);
const S = ctx.SWAY, base = S.cdn[0], f = {
  'ffmpeg.js': `${base}@ffmpeg/ffmpeg@${S.ffmpeg}/dist/umd/ffmpeg.js`, worker: `${base}@ffmpeg/ffmpeg@${S.ffmpeg}/dist/umd/${S.worker}`,
  'core.js': `${base}@ffmpeg/core@${S.core}/dist/umd/ffmpeg-core.js`, 'core.wasm': `${base}@ffmpeg/core@${S.core}/dist/umd/ffmpeg-core.wasm` };
const out = {};
for (const [k, u] of Object.entries(f)) { const r = await fetch(u); if (!r.ok) throw new Error(u + ' → HTTP ' + r.status); out[k] = 'sha384-' + crypto.createHash('sha384').update(Buffer.from(await r.arrayBuffer())).digest('base64'); console.error('ok', u); }
console.log('sri: ' + JSON.stringify(out, null, 2).replace(/"(\w+)":/g, '$1:').replace(/^/gm, '  ').trim() + ',');
