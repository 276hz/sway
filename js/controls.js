// Sway: settings panel: control schema, DOM, persistence (sway.settings.v3)
const OUT_FMT = Object.entries(FORMATS).map(([k, f]) => [k, f.name]);
const MKEYS = [['title', 'title', 'Tiêu đề'], ['artist', 'artist', 'Nghệ sĩ'], ['album', 'album', 'Album'], ['albumartist', 'album_artist', 'Nghệ sĩ album'], ['year', 'date', 'Năm'], ['genre', 'genre', 'Thể loại'], ['track', 'track', 'Số bài'], ['disc', 'disc', 'Số đĩa'], ['composer', 'composer', 'Soạn nhạc'], ['comment', 'comment', 'Ghi chú']];
const CTL = [
  { id: 'preset', label: 'Kiểu âm thanh', val: 'none', opts: [...Object.entries(PRESETS).map(([k, v]) => [k, v[0]]), ['custom', 'Tùy chỉnh (đã chỉnh tay)']], groups: [...PGROUPS.map(([g, ks]) => [g, ks.map(k => [k, PRESETS[k][0]])]), ['Khác', [['custom', 'Tùy chỉnh (đã chỉnh tay)']]]] },

  { id: 'speed', g: 'Tốc độ · cao độ · âm sắc · giọng', fx: 1, label: 'Tốc độ', min: 50, max: 200, step: 5, val: 100, fmt: v => (v / 100).toFixed(2) + '×' },
  { id: 'spdm', fx: 1, label: 'Kiểu đổi tốc độ', val: 'pitch', opts: [['pitch', 'Đổi cả cao độ (kiểu đĩa than)'], ['keep', 'Giữ nguyên cao độ']] },
  { id: 'eq', fx: 1, label: 'Âm sắc (EQ)', val: 'none', opts: [['none', 'Giữ nguyên'], ['warm', 'Ấm'], ['bright', 'Sáng'], ['bass', 'Bass mạnh'], ['muffled', 'Bị nghẹt'], ['radio', 'Radio cũ']] },
  { id: 'width', fx: 1, label: 'Độ rộng stereo', min: 0, max: 200, step: 5, val: 100, fmt: v => v + '%' },
  { id: 'semis', fx: 1, label: 'Cao độ (giữ tốc độ)', min: -12, max: 12, step: 1, val: 0, fmt: v => (v > 0 ? '+' : '') + v + ' ' + t('ust') },
  { id: 'bassdb', fx: 1, label: 'Bass', min: -12, max: 12, step: 1, val: 0, fmt: v => (v > 0 ? '+' : '') + v + ' dB' },
  { id: 'middb', fx: 1, label: 'Mid (giọng)', min: -12, max: 12, step: 1, val: 0, fmt: v => (v > 0 ? '+' : '') + v + ' dB' },
  { id: 'trebdb', fx: 1, label: 'Treble', min: -12, max: 12, step: 1, val: 0, fmt: v => (v > 0 ? '+' : '') + v + ' dB' },
  { id: 'kara', fx: 1, label: 'Giảm giọng giữa (karaoke)', min: 0, max: 100, step: 5, val: 0, fmt: v => v + '%' },
  { id: 'dn', fx: 1, label: 'Khử nhiễu', val: 'off', opts: [['off', 'Tắt'], ['10', 'Nhẹ'], ['20', 'Vừa'], ['30', 'Mạnh']] },
  { id: 'comp', fx: 1, label: 'Nén động (compressor)', val: 'off', opts: [['off', 'Tắt'], ['soft', 'Nhẹ'], ['mid', 'Vừa'], ['hard', 'Mạnh']] },
  { id: 'fxm', g: 'Điều chế · thời gian', fx: 1, label: 'Hiệu ứng điều chế', val: 'off', opts: [['off', 'Tắt'], ['tremolo', 'Tremolo'], ['vibrato', 'Vibrato'], ['chorus', 'Chorus'], ['flanger', 'Flanger'], ['phaser', 'Phaser'], ['lofi', 'Lo-fi (bitcrush)']] },
  { id: 'rev', fx: 1, label: 'Phát ngược', val: 'off', opts: [['off', 'Tắt'], ['on', 'Bật']] },
  { id: 'fin', fx: 1, label: 'Fade in', min: 0, max: 10, step: 0.5, val: 0, fmt: v => v + ' ' + t('us') },
  { id: 'fout', fx: 1, label: 'Fade out', min: 0, max: 10, step: 0.5, val: 0, fmt: v => v + ' ' + t('us') },

  { id: 'pmode', g: 'Panner · không gian', fx: 1, label: 'Kiểu chuyển động', val: 'lr', opts: [['off', 'Tắt'], ['lr', 'Trái ↔ phải'], ['circle', '8D vòng tròn'], ['circle_rev', '8D vòng tròn ngược chiều'], ['swing_front', '8D lắc phía trước'], ['swing_back', '8D lắc phía sau'], ['fig8', '8D hình số 8'], ['drift', '8D trôi ngẫu nhiên']] },
  { id: 'pshape', fx: 1, label: 'Dạng LFO (trái ↔ phải)', val: 'sine', opts: [['sine', 'Sine'], ['tri', 'Triangle'], ['sq', 'Square mượt']] },
  { id: 'bars', fx: 1, label: 'Chu kỳ LFO', min: 1, max: 16, step: 1, val: 4, fmt: v => v + ' ' + t('ub') + ' · ' + (v * 240 / BPM).toFixed(0) + ' ' + t('us') },
  { id: 'panAmt', fx: 1, label: 'Độ mạnh panner', min: 0, max: 100, step: 1, val: 0, fmt: v => v + '%' },

  { id: 'rv', g: 'Reverb', fx: 1, label: 'Loại', val: 'off', opts: [['off', 'Tắt'], ...Object.entries(RV).map(([k, v]) => [k, v.name])] },
  { id: 'revAmt', fx: 1, label: 'LFO amount (decay + filter)', min: 0, max: 100, step: 1, val: 0, fmt: v => v + '%' },
  { id: 'mix', fx: 1, label: 'Mức reverb (mix)', min: 0, max: 100, step: 1, val: 0, fmt: v => v + '%' },
  { id: 'decay', fx: 1, label: 'Độ dài reverb', min: 50, max: 200, step: 5, val: 100, fmt: v => v + '%' },

  { id: 'dly', g: 'Echo / delay (ping-pong, theo nhịp 120 BPM)', fx: 1, label: 'Độ dài nhịp', val: 'off', opts: [['off', 'Tắt'], ['e16', '1/16'], ['e8', '1/8'], ['d8', '1/8 chấm'], ['q', '1/4'], ['h', '1/2']] },
  { id: 'fb', fx: 1, label: 'Feedback', min: 0, max: 90, step: 1, val: 40, fmt: v => v + '%' },
  { id: 'dmix', fx: 1, label: 'Mức echo', min: 0, max: 100, step: 1, val: 30, fmt: v => v + '%' },

  { id: 'gain', g: 'Tinh chỉnh âm thanh', label: 'Tăng giảm âm lượng (gain)', min: -24, max: 24, step: 1, val: 0, ns: 1, fmt: v => (v > 0 ? '+' : '') + v + ' dB' },
  { id: 'hp', label: 'Lọc thông cao (high-pass)', val: 'off', ns: 1, opts: [['off', 'Tắt'], ['40', '40 Hz'], ['80', '80 Hz'], ['120', '120 Hz'], ['200', '200 Hz']] },
  { id: 'lp', label: 'Lọc thông thấp (low-pass)', val: 'off', ns: 1, opts: [['off', 'Tắt'], ['16000', '16 kHz'], ['12000', '12 kHz'], ['8000', '8 kHz'], ['5000', '5 kHz']] },
  { id: 'chm', label: 'Xử lý kênh', val: 'off', ns: 1, opts: [['off', 'Bình thường'], ['swap', 'Đổi trái ↔ phải'], ['left', 'Chỉ kênh trái'], ['right', 'Chỉ kênh phải'], ['inv', 'Đảo pha kênh phải']] },
  { id: 'sil', label: 'Cắt khoảng lặng', val: 'off', ns: 1, opts: [['off', 'Tắt'], ['start', 'Đầu bài'], ['end', 'Cuối bài'], ['both', 'Đầu và cuối']] },
  { id: 'ts', label: 'Bắt đầu (giây)', t: 'number', ns: 1 },
  { id: 'te', label: 'Kết thúc (giây, 0 = hết bài)', t: 'number', ns: 1 },
  { id: 'vbr', label: 'Chế độ chất lượng MP3', val: 'off', opts: [['off', 'CBR (bitrate bên dưới)'], ['0', 'VBR V0 (tốt nhất)'], ['2', 'VBR V2'], ['4', 'VBR V4']] },
  { id: 'mkeep', g: 'Metadata (tag và ảnh bìa)', label: 'Tag gốc', val: 'keep', ns: 1, opts: [['keep', 'Giữ'], ['strip', 'Xóa hết']] },
  { id: 'cmode', label: 'Ảnh bìa gốc', val: 'keep', ns: 1, opts: [['keep', 'Giữ'], ['none', 'Xóa']] },
  { id: 'cover', label: 'Thay ảnh bìa (JPG/PNG)', t: 'file', ns: 1 },
  { id: 'trauto', label: 'Đánh số bài', val: 'keep', ns: 1, opts: [['keep', 'Theo ô nhập'], ['auto', 'Tự đánh số']] },
  ...MKEYS.map(([id, , label]) => ({ id: 'm_' + id, label, t: 'text', ns: 1, ml: id === 'comment' ? 1000 : 256 })),

  { id: 'fmt', g: 'Đầu ra nâng cao', label: 'Định dạng đầu ra', val: 'flac', opts: OUT_FMT },
  { id: 'sr', label: 'Sample rate', val: '44100', opts: [['44100', '44,1 kHz'], ['48000', '48 kHz'], ['88200', '88,2 kHz'], ['96000', '96 kHz'], ['orig', 'Giữ như file gốc']] },
  { id: 'depth', label: 'Bit depth', val: '16', opts: [['16', '16-bit (có dither)'], ['24', '24-bit'], ['32', '32-bit float']] },
  { id: 'kbps', label: 'Bitrate', val: '256', opts: [['128', '128 kbps'], ['192', '192 kbps'], ['256', '256 kbps'], ['320', '320 kbps']] },
  { id: 'lufs', fx: 1, label: 'Chuẩn hóa độ to (LUFS)', val: 'off', opts: [['off', 'Tắt'], ['-14', '-14 LUFS (Spotify, YouTube)'], ['-16', '-16 LUFS (podcast)'], ['-23', '-23 LUFS (phát thanh EBU)']] },
  { id: 'ch', label: 'Kênh', val: '2', opts: [['2', 'Stereo'], ['1', 'Mono']] },
  { id: 'norm', label: 'Chuẩn hóa đỉnh', val: 'down', opts: [['down', 'Chỉ hạ nếu vượt ngưỡng (khuyên dùng)'], ['full', 'Luôn kéo đỉnh về mức tối đa']] },
  { id: 'peak', label: 'Đỉnh tối đa', min: -6, max: -0.1, step: 0.1, val: -1, fmt: v => (+v).toFixed(1) + ' dBFS' },
];
const tr = (el, k) => { if (el.dataset.v === undefined) el.dataset.v = el.textContent; const x = TX[k]; el.textContent = (LANG !== 'vi' && x) ? x[LANG === 'zh' ? 0 : 1] : el.dataset.v; };
function trAdv() {
  const hs = [...document.querySelectorAll('#adv h3')];
  CTL.filter(c => c.g).forEach((c, i) => tr(hs[i], 'g.' + c.id));
  CTL.forEach(c => {
    if (c.id === 'preset') return;
    if (c.id !== 'fmt') tr($('row-' + c.id).firstChild, c.id);
    if (c.opts) [...$(c.id).options].forEach(o => tr(o, TX[c.id + '.' + o.value] ? c.id + '.' + o.value : 'o.' + o.value));
  });
}
const optHtml = c => (c.groups ? c.groups.map(g => `<optgroup label="${g[0]}">${g[1].map(o => `<option value="${o[0]}">${o[1]}</option>`).join('')}</optgroup>`) : [c.opts.map(o => `<option value="${o[0]}">${o[1]}</option>`).join('')]).join('');
let sec = null, lastG = null;
CTL.forEach(c => {
  if (c.g && c.g !== lastG) { sec = document.createElement('section'); sec.className = 'g'; const h = document.createElement('h3'); h.textContent = c.g; sec.appendChild(h); $('adv').appendChild(sec); lastG = c.g;
    if (c.id === 'mkeep') { const n = document.createElement('p'); n.id = 'mnote'; n.className = 'note'; n.hidden = true; sec.appendChild(n); } }
  if (c.id === 'preset' || c.id === 'fmt') {
    const f = document.createElement('label'); f.className = 'field';
    f.innerHTML = `<span></span><select id="${c.id}">${optHtml(c)}</select>`;
    f.firstChild.textContent = c.id === 'preset' ? 'Hiệu ứng' : 'Định dạng đầu ra';
    f.querySelector('select').value = c.val; $('slot-' + c.id).appendChild(f); return;
  }
  const row = document.createElement('div'); row.className = 'row'; row.id = 'row-' + c.id;
  row.innerHTML = c.opts
    ? `<label for="${c.id}"></label><select id="${c.id}">${optHtml(c)}</select>`
    : c.t ? `<label for="${c.id}"></label><input type="${c.t}" id="${c.id}"${c.t === 'file' ? ' accept="image/jpeg,image/png"' : c.t === 'number' ? ' autocomplete="off" inputmode="decimal" min="0" step="any"' : ` autocomplete="off" maxlength="${c.ml || 256}"`}>`
    : `<label for="${c.id}"></label><input type="range" id="${c.id}" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.val}"><output for="${c.id}" aria-live="off"></output>`;
  if (c.opts) row.querySelector('select').value = c.val;
  row.firstChild.textContent = c.label; sec.appendChild(row);
});
const showVal = c => { if (!c.fmt) return; const el = $(c.id), s = c.fmt(+el.value); el.parentNode.querySelector('output').textContent = s; el.setAttribute('aria-valuetext', s); };
function refresh() {
  const F = FORMATS[$('fmt').value];
  $('row-kbps').hidden = !F.lossy; $('row-vbr').hidden = $('fmt').value !== 'mp3'; $('row-cover').hidden = $('row-cmode').hidden = !COVER_FMT.includes($('fmt').value); $('row-depth').hidden = !F.depth;
  if (F.depth) { [...$('depth').options].forEach(o => { o.hidden = !F.depth.includes(+o.value); }); if (!F.depth.includes(+$('depth').value)) $('depth').value = String(F.depth[0]); }
  $('row-pshape').hidden = $('pmode').value !== 'lr';
  $('pdesc').textContent = pdesc($('preset').value) + (F.video ? ' · ' + t('vid') : '') + ($('preset').value === 'xuanha' && files.length !== 2 ? ' · ' + t('pairNeed') : '');
  // MP4/MKV giữ nguyên hình: nói rõ khi cài đặt hiện tại làm lệch tiếng và hình (hình không đổi theo), hoặc kéo dài đuôi âm thanh
  const P = getP(), risk = F.video ? syncRisk(P) : [], vw = $('vwarn');
  vw.hidden = !(F.video && (risk.length || hasTail(P)));
  vw.className = 'hint warn' + (risk.length ? ' bad' : '');
  vw.textContent = vw.hidden ? '' : risk.length ? t('vsync', { r: risk.map(k => t(k)).join(t('sep')) }) : t('vtail');
  const f = $('fmt').value, mn = $('mnote');
  mn.textContent = TAG_LIMITED.includes(f) ? t('mnLim') : TAG_NOCOVER.includes(f) ? t('mnCover') : ''; mn.hidden = !mn.textContent;
}
function applyPreset(k) {
  const base = PRESETS[k][1]; $('preset').value = k;
  CTL.filter(c => c.fx).forEach(c => { $(c.id).value = base[c.id] !== undefined ? base[c.id] : c.val; showVal(c); });
  refresh();
}
const SKEY = 'sway.settings.v3', OLDKEY = 'sway.settings.v2';
const save = () => { try { localStorage.setItem(SKEY, JSON.stringify(Object.fromEntries(CTL.filter(c => !c.ns).map(c => [c.id, $(c.id).value])))); } catch (_) {} };
function loadSaved() {
  try {
    let v = JSON.parse(localStorage.getItem(SKEY) || 'null');
    if (!v) {   // v2 → v3: v2 luôn lưu FL Mobile như mặc định cũ, nên chỉ giữ cài đặt đầu ra; lựa chọn hiệu ứng khác FL Mobile thì giữ nguyên
      v = JSON.parse(localStorage.getItem(OLDKEY) || 'null');
      if (v && (!v.preset || v.preset === 'flmobile')) v = Object.fromEntries(CTL.filter(c => !c.fx && c.id !== 'preset' && v[c.id] !== undefined).map(c => [c.id, v[c.id]]));
      if (v) { localStorage.setItem(SKEY, JSON.stringify(v)); localStorage.removeItem(OLDKEY); }
    }
    if (!v) return;
    CTL.forEach(c => { const el = $(c.id); if (v[c.id] !== undefined && (!c.opts || [...el.options].some(o => o.value === v[c.id]))) el.value = v[c.id]; });
    CTL.forEach(showVal); refresh();
  } catch (_) {}
}
const getP = () => {
  const g = id => $(id).value, n = id => +$(id).value;
  return {
    none: g('preset') === 'none', pair: g('preset') === 'xuanha', speed: n('speed') / 100, spdm: g('spdm'), eq: g('eq'), width: n('width') / 100,
    semis: n('semis'), bassdb: n('bassdb'), middb: n('middb'), trebdb: n('trebdb'), kara: n('kara') / 100, dn: g('dn') === 'off' ? 0 : n('dn'), comp: g('comp'), fxm: g('fxm'), rev: g('rev'), fin: n('fin'), fout: n('fout'), lufs: g('lufs') === 'off' ? 0 : n('lufs'), ch: n('ch'),
    pmode: g('pmode'), pshape: g('pshape'), bars: n('bars'), panAmt: n('panAmt') / 100,
    rv: g('rv'), revAmt: n('revAmt') / 100, mix: n('mix') / 100, decay: n('decay') / 100,
    dly: g('dly'), fb: n('fb') / 100, dmix: n('dmix') / 100,
    gain: n('gain'), hp: g('hp') === 'off' ? 0 : n('hp'), lp: g('lp') === 'off' ? 0 : n('lp'), chm: g('chm'), sil: g('sil'), ts: sec3($('ts').value), te: sec3($('te').value) > sec3($('ts').value) ? sec3($('te').value) : 0,
    vbr: g('vbr'), strip: g('mkeep') === 'strip', cmode: g('cmode'), cover: !!$('cover').files[0], trauto: g('trauto') === 'auto', meta: MKEYS.map(([id, key]) => [key, $('m_' + id).value.trim()]).filter(x => x[1]),
    fmt: g('fmt'), sr: g('sr'), depth: n('depth'), kbps: n('kbps'), norm: g('norm'), peak: n('peak'),
  };
};
// Xuân-Hạ chỉ dùng khi có đúng 2 file: đang chọn mà số file đổi thì quay về "Không hiệu ứng"; mỗi dòng ghi rõ kênh trái/phải
function syncPair(quiet) {
  if ($('preset').value === 'xuanha' && files.length !== 2) { applyPreset('none'); if (!quiet) setTimeout(() => status(() => t('pairOff')), 0); }
  fillPreset(); refresh();
  const on = $('preset').value === 'xuanha' && files.length === 2;
  if (!busy && !results.length) files.forEach((x, i) => { x.st = { k: on ? (i ? 'pairR' : 'pairL') : '' }; paintRow(x); });
}
