#!/usr/bin/env node
// Sway: sinh các trang tĩnh theo ngôn ngữ từ tools/index.template.html + js/i18n-data.js (nguồn chuỗi duy nhất).
//   node tools/build-pages.mjs          → ghi index.html (中文), en/index.html, vi/index.html, 404.html
//   node tools/build-pages.mjs --check  → chỉ kiểm tra file đã sinh có khớp không (thoát mã 1 nếu lệch)
// Lý do: mỗi ngôn ngữ có URL riêng + nội dung HTML thật (title/description/FAQ/JSON-LD/hreflang) để công cụ tìm kiếm lập chỉ mục
// đúng, thay vì chỉ đổi chữ bằng JavaScript. Không cần bước build khi deploy: các file sinh ra được commit cùng mã nguồn.
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://swaymusic.pages.dev';   // đổi khi dùng tên miền riêng, rồi chạy lại script này (và sửa sitemap.xml, robots.txt)
const LANGS = ['zh', 'en', 'vi'], FAQ_IDS = [5, 7, 9, 11, 13];
const HREFLANG = { zh: 'zh-CN', en: 'en', vi: 'vi' }, OGLOC = { zh: 'zh_CN', en: 'en_US', vi: 'vi_VN' };
const dir = l => l === 'zh' ? '' : l + '/', urlOf = l => SITE + '/' + dir(l);
const rel = (from, to) => from === to ? './' : from === 'zh' ? dir(to) : to === 'zh' ? '../' : '../' + dir(to);

const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/i18n-data.js'), 'utf8').replace(/^const /gm, 'var '), ctx);
const { D, LC } = ctx, LI = { zh: 0, en: 1, vi: 2 };
const tr = (l, k) => { if (!D[k]) throw new Error('missing i18n key: ' + k); return D[k][LI[l]]; };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const json = o => JSON.stringify(o).replace(/</g, '\\u003c');

function ldApp(l) { return json({ '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Sway', url: urlOf(l), description: tr(l, 'ldd'), applicationCategory: 'MultimediaApplication', operatingSystem: 'Any', browserRequirements: 'Requires JavaScript and WebAssembly', inLanguage: ['zh-CN', 'en', 'vi'], isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } }); }
// Giống hệt ldFaq() trong js/app.js (cùng khóa, cùng thứ tự)
function ldFaq(l) { return json({ '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: LC[l], mainEntity: FAQ_IDS.map(i => ({ '@type': 'Question', name: tr(l, 'i' + i), acceptedAnswer: { '@type': 'Answer', text: tr(l, 'i' + (i + 1)) } })) }); }

function render(l, tpl) {
  const raw = {
    lang: LC[l], fixed: l === 'zh' ? '' : ` data-fixed-lang="${l}"`, url: urlOf(l), site: SITE, base: l === 'zh' ? '' : '../',
    og_locale: OGLOC[l], og_alt_locales: LANGS.filter(x => x !== l).map(x => `<meta property="og:locale:alternate" content="${OGLOC[x]}">`).join(''),
    alternates: LANGS.map(x => `<link rel="alternate" hreflang="${HREFLANG[x]}" href="${urlOf(x)}">`).concat(`<link rel="alternate" hreflang="x-default" href="${urlOf('zh')}">`).join(''),
    sel_zh: l === 'zh' ? ' selected' : '', sel_en: l === 'en' ? ' selected' : '', sel_vi: l === 'vi' ? ' selected' : '',
    rel_zh: rel(l, 'zh'), rel_en: rel(l, 'en'), rel_vi: rel(l, 'vi'), ld_app: ldApp(l), ld_faq: ldFaq(l),
  };
  return tpl.replace(/\{\{(@?)([\w.]+)\}\}/g, (_, at, k) => { if (at) { if (!(k in raw)) throw new Error('unknown placeholder @' + k); return raw[k]; } return esc(tr(l, k)); });
}
function render404() {
  const blocks = LANGS.map(l => `<section lang="${HREFLANG[l]}"><h1>${esc(tr(l, 'nf'))}</h1><p>${esc(tr(l, 'nfd'))}</p><p><a href="/${dir(l)}">${esc(tr(l, 'nfb'))}</a></p></section>`).join('\n');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>404 · Sway</title>
<meta name="robots" content="noindex">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/css/styles.css">
</head>
<body>
<div class="wrap"><header class="top"><a class="brand" href="/" aria-label="Sway"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3 12c2.5-7 5.5-7 9 0s6.5 7 9 0"/></svg>Sway</a></header>
<main class="hero">
${blocks}
</main></div>
</body>
</html>
`;
}

const tpl = fs.readFileSync(path.join(ROOT, 'tools/index.template.html'), 'utf8'), out = {};
for (const l of LANGS) out[path.join(l === 'zh' ? '' : l, 'index.html')] = render(l, tpl);
out['404.html'] = render404();
const alts = LANGS.map(x => `<xhtml:link rel="alternate" hreflang="${HREFLANG[x]}" href="${urlOf(x)}"/>`).concat(`<xhtml:link rel="alternate" hreflang="x-default" href="${urlOf('zh')}"/>`).join('');
out['sitemap.xml'] = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${LANGS.map(l => `  <url><loc>${urlOf(l)}</loc>${alts}</url>`).join('\n')}\n</urlset>\n`;
out['robots.txt'] = `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`;
let bad = 0;
for (const [f, text] of Object.entries(out)) {
  const p = path.join(ROOT, f);
  if (process.argv.includes('--check')) { const cur = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; if (cur !== text) { console.error('OUT OF DATE:', f); bad++; } }
  else { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); console.log('wrote', f); }
}
process.exit(bad ? 1 : 0);
