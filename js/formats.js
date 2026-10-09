// Sway: định dạng đầu ra, dòng lệnh ffmpeg, đọc WAV float32, bộ lọc giải mã, các giới hạn bộ nhớ
const FORMATS = {
  flac: { name: 'FLAC (lossless)', ext: 'flac', depth: [16, 24], codec: 'flac', extra: ['-compression_level', '8'], sf: d => d === 24 ? 's32' : 's16' },
  wav:  { name: 'WAV (lossless)', ext: 'wav', depth: [16, 24, 32], codec: d => d === 32 ? 'pcm_f32le' : d === 24 ? 'pcm_s24le' : 'pcm_s16le', sf: d => d === 32 ? 'flt' : d === 24 ? 's32' : 's16' },
  aiff: { name: 'AIFF (lossless)', ext: 'aiff', depth: [16, 24], codec: d => d === 24 ? 'pcm_s24be' : 'pcm_s16be', sf: d => d === 24 ? 's32' : 's16' },
  alac: { name: 'ALAC · M4A (lossless)', ext: 'm4a', depth: [16, 24], codec: 'alac', sf: d => d === 24 ? 's32p' : 's16p' },
  mp3:  { name: 'MP3', ext: 'mp3', lossy: true, codec: 'libmp3lame', max: 48000 },
  aac:  { name: 'AAC · M4A', ext: 'm4a', lossy: true, codec: 'aac', max: 96000 },
  ogg:  { name: 'OGG Vorbis', ext: 'ogg', lossy: true, codec: 'libvorbis', max: 48000 },
  opus: { name: 'Opus', ext: 'opus', lossy: true, codec: 'libopus', rate: 48000 },
  ac3:  { name: 'AC3 (Dolby Digital)', ext: 'ac3', lossy: true, codec: 'ac3', rates: [32000, 44100, 48000] },
  mp2:  { name: 'MP2', ext: 'mp2', lossy: true, codec: 'mp2', max: 48000 },
  wma:  { name: 'WMA', ext: 'wma', lossy: true, codec: 'wmav2', max: 48000 },
  mp4:  { name: 'MP4 · giữ hình gốc, âm thanh AAC', ext: 'mp4', lossy: true, video: true, codec: 'aac', max: 96000 },
  mkv:  { name: 'MKV · giữ hình gốc, âm thanh FLAC', ext: 'mkv', video: true, depth: [16, 24], codec: 'flac', extra: ['-compression_level', '8'], sf: d => d === 24 ? 's32' : 's16' },
};
const COVER_FMT = ['mp3', 'flac', 'aac', 'alac'];   // định dạng nhúng được ảnh bìa
// Định dạng ghi được ít loại tag / không có ảnh bìa (chỉ để báo cho người dùng, không chặn)
const TAG_LIMITED = ['wav', 'aiff', 'ac3'], TAG_NOCOVER = ['ogg', 'opus', 'mp2', 'wma', 'wav', 'aiff', 'ac3'];

// ---- Giới hạn bộ nhớ (xem README: "Bộ nhớ") ----
const MAX_FILE = 1.8 * 2 ** 30;   // file nguồn lớn hơn mức này không đọc nổi vào một ArrayBuffer
const MAX_PCM = 1.8e9;            // PCM float32 stereo sau giải mã lớn hơn mức này vượt giới hạn mảng/ffmpeg.wasm (~2 GB mỗi mảng)
const HEAVY_PCM = 1.28e8;         // quá mức này (~6 phút stereo 44,1 kHz) thì giải phóng ffmpeg sau khi xong để trả bộ nhớ wasm
// Ước lượng byte PCM float32 stereo sau giải mã (cắt khoảng lặng cuối dùng areverse nên giữ thêm một bản trong ffmpeg)
const pcmBytes = (sec, rate, P) => sec > 0 ? sec * (rate || 48000) * 8 * (P && (P.sil === 'end' || P.sil === 'both') ? 2 : 1) : 0;

// Tần số lấy mẫu đầu ra hợp lệ cho từng bộ mã hóa
function outRate(F, P, rate) {
  let sr = P.sr === 'orig' ? rate : +P.sr;
  if (!(sr >= 8000)) sr = rate >= 8000 ? rate : 44100;
  if (F.rate) return F.rate;
  if (F.max && sr > F.max) sr = F.max;
  if (F.rates && !F.rates.includes(sr)) sr = F.rates.find(r => r >= sr) || F.rates[F.rates.length - 1];
  return sr;
}
const cleanTag = v => String(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, 2000);

// Lệnh ffmpeg cuối: resample (sinc 64 điểm) + dither + hạ bit đúng MỘT lần; giữ tag của file gốc.
// P.srcCover = số thứ tự stream ảnh bìa trong file gốc (hoặc null). Đầu vào: 0 = fx.wav, 1 = file gốc, 2 = ảnh bìa mới (nếu có).
function buildArgs(P, rate) {
  const F = FORMATS[P.fmt], sr = outRate(F, P, rate);
  const depth = F.depth ? (F.depth.includes(P.depth) ? P.depth : F.depth[0]) : 0;
  const cv = !F.video && COVER_FMT.includes(P.fmt), u = cv && P.cover, s = cv && !u && P.srcCover != null && !P.strip && P.cmode === 'keep';
  const a = ['-i', 'fx.wav', '-i', 'in', ...(u ? ['-i', 'cover.img'] : []), '-map', '0:a:0'];
  if (F.video) a.push('-map', '1:v:0?', '-c:v', 'copy');
  else if (u) a.push('-map', '2:v:0', '-c:v', 'copy', '-disposition:v:0', 'attached_pic');
  else if (s) a.push('-map', '1:' + (+P.srcCover || 0), '-c:v', 'copy', '-disposition:v:0', 'attached_pic');
  const lufs = P.lufs ? `loudnorm=I=${clampN(P.lufs, -70, -5, -14)}:TP=-1:LRA=11,` : '';
  a.push('-map_metadata', P.strip ? '-1' : '1', '-af', lufs + `aresample=${sr}:filter_size=64:cutoff=0.98:dither_method=triangular_hp`, ...(P.ch === 1 ? ['-ac', '1'] : []),
    '-c:a', typeof F.codec === 'function' ? F.codec(depth) : F.codec);
  if (F.extra) a.push(...F.extra);
  if (F.sf) a.push('-sample_fmt', F.sf(depth));
  if (F.lossy) { if (P.fmt === 'mp3' && P.vbr !== 'off') a.push('-q:a', String(clampN(P.vbr, 0, 9, 2))); else a.push('-b:a', clampN(P.kbps, 32, 640, 256) + 'k'); }
  if (P.fmt === 'mp3') a.push('-id3v2_version', '3');
  const meta = (P.meta || []).filter(([k]) => !(P.trauto && P.cnt && k === 'track')); if (P.trauto && P.cnt) meta.push(['track', P.idx + '/' + P.cnt]);
  for (const [k, v] of meta) { const c = cleanTag(v); if (c) a.push('-metadata', k + '=' + c); }
  a.push('out.' + F.ext);
  return a;
}

// ---- Đọc WAV float32 stereo do ffmpeg ghi ----
// Duyệt từng chunk (không giả định vị trí cố định), kiểm tra định dạng, thay NaN/±Infinity bằng 0 để không lan vào DSP.
function parseWav(u8) {
  const bad = () => new UserError('wavE');
  if (u8.length < 44) throw bad();
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const tag = o => String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw bad();
  let p = 12, rate = 0, ch = 0, bits = 0, fmt = 0;
  while (p + 8 <= u8.length) {
    const id = tag(p), size = v.getUint32(p + 4, true);
    if (id === 'fmt ' && p + 24 <= u8.length) { fmt = v.getUint16(p + 8, true); ch = v.getUint16(p + 10, true); rate = v.getUint32(p + 12, true); bits = v.getUint16(p + 22, true); }
    else if (id === 'data') {
      if (!rate || ch !== 2 || bits !== 32 || (fmt !== 3 && fmt !== 0xFFFE)) throw bad();
      const n = Math.floor(Math.min(size, u8.length - p - 8) / 8), o = p + 8;   // size có thể sai/0xFFFFFFFF với file ghi dạng luồng
      const L = new Float32Array(n), R = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        let l = v.getFloat32(o + i * 8, true), r = v.getFloat32(o + i * 8 + 4, true);
        if (l - l !== 0) l = 0; if (r - r !== 0) r = 0;   // NaN / ±Infinity
        L[i] = l; R[i] = r;
      }
      return { rate, L, R };
    }
    p += 8 + size + (size & 1);
  }
  throw bad();
}

// ---- Bộ lọc ffmpeg áp ngay sau giải mã (float32): cắt → khoảng lặng → lọc → kênh → khử nhiễu → tốc độ → cao độ → điều chế → nén động → gain ----
const FXM = {
  tremolo: 'tremolo=f=5:d=0.6', vibrato: 'vibrato=f=5:d=0.4',
  chorus: 'chorus=0.6:0.9:55|45:0.4|0.32:0.25|0.4:2|2.3', flanger: 'flanger=delay=3:depth=4:speed=0.4',
  phaser: 'aphaser=in_gain=0.6:out_gain=0.7:delay=3:decay=0.4:speed=0.5', lofi: 'acrusher=bits=9:mode=lin:mix=0.8,lowpass=f=6500',
};
const COMP = {
  soft: 'acompressor=threshold=-20dB:ratio=2:attack=30:release=300:makeup=2',
  mid: 'acompressor=threshold=-24dB:ratio=3.5:attack=20:release=250:makeup=4',
  hard: 'acompressor=threshold=-28dB:ratio=6:attack=10:release=200:makeup=6',
};
const SIL = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.1';
const CHM = { swap: 'pan=stereo|c0=c1|c1=c0', left: 'pan=stereo|c0=c0|c1=c0', right: 'pan=stereo|c0=c1|c1=c1', inv: 'pan=stereo|c0=c0|c1=-1*c1' };
const sec3 = x => +clampN(x, 0, 359999, 0).toFixed(3);   // giây, không bao giờ ra dạng số mũ trong dòng lệnh
function decodeFilterList(P, rate) {
  const a = [], speed = clampN(P.speed, 0.5, 2, 1), semis = Math.round(clampN(P.semis, -12, 12, 0)), ts = sec3(P.ts), te = sec3(P.te);
  if (ts || te) a.push(`atrim=start=${ts}${te ? ':end=' + te : ''}`, 'asetpts=PTS-STARTPTS');
  if (P.sil === 'start' || P.sil === 'both') a.push(SIL);
  if (P.sil === 'end' || P.sil === 'both') a.push('areverse', SIL, 'areverse');
  if (P.hp) a.push(`highpass=f=${clampN(P.hp, 10, 1000, 80)}`);
  if (P.lp) a.push(`lowpass=f=${clampN(P.lp, 1000, 22000, 16000)}`);
  if (CHM[P.chm]) a.push(CHM[P.chm]);
  if (P.dn) a.push(`afftdn=nr=${clampN(P.dn, 1, 97, 20)}`);
  if (speed !== 1) a.push(P.spdm === 'keep' ? `atempo=${speed}` : `asetrate=${Math.round(rate * speed)},aresample=${rate}`);
  if (semis) { const f = Math.pow(2, semis / 12); a.push(`asetrate=${Math.round(rate * f)},aresample=${rate},atempo=${(1 / f).toFixed(6)}`); }
  if (FXM[P.fxm]) a.push(FXM[P.fxm]);
  if (COMP[P.comp]) a.push(COMP[P.comp]);
  if (P.gain) a.push(`volume=${clampN(P.gain, -24, 24, 0)}dB`);
  return a;
}

// Cài đặt nào làm đổi độ dài/điểm bắt đầu của âm thanh trong khi hình ảnh được giữ nguyên (MP4/MKV)? Trả về danh sách khóa i18n.
function syncRisk(P) {
  const r = [];
  if (clampN(P.speed, 0.5, 2, 1) !== 1) r.push('rsSpeed');
  if (sec3(P.ts) || sec3(P.te)) r.push('rsTrim');
  if (P.sil && P.sil !== 'off') r.push('rsSil');
  if (!P.none && P.rev === 'on') r.push('rsRev');
  if (P.pair) r.push('rsPair');
  return r;
}
// Hiệu ứng kéo dài đuôi (reverb/echo) làm âm thanh dài hơn hình một chút: chỉ nhắc, không chặn
const hasTail = P => !P.none && ((P.rv && P.rv !== 'off' && P.mix > 0) || (P.dly && P.dly !== 'off' && P.dmix > 0));
