// Sway: ngôn ngữ hiện tại và hàm t()
const COARSE = matchMedia('(pointer:coarse)').matches || (navigator.maxTouchPoints > 0 && innerWidth < 700);
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
// Trang tĩnh /en/ và /vi/ khai báo ngôn ngữ cố định (data-fixed-lang); trang gốc mặc định 中文, dùng lựa chọn đã lưu nếu có.
let LANG = 'zh';
{
  const fixed = document.documentElement.dataset.fixedLang;
  let stored = null; try { stored = localStorage.getItem('sway.lang'); } catch (_) {}
  if (fixed && hasOwn(LI, fixed)) LANG = fixed; else if (stored && hasOwn(LI, stored)) LANG = stored;
}
// t(khóa, {biến}): thiếu bản dịch thì rơi về tiếng Việt, thiếu khóa thì trả lại chính khóa. Thay thế bằng split/join để ký tự "$" trong tên file không bị hiểu nhầm.
const t = (k, v) => {
  const e = hasOwn(D, k) ? D[k] : null;
  let r = e ? (e[LI[LANG]] || e[2] || k) : k;
  if (v) for (const x in v) r = r.split('{' + x + '}').join(String(v[x]));
  return r;
};
