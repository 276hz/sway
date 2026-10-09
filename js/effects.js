// Sway: DSP — EQ, echo, reverb, 8D, panner, render(), ghi WAV float32
// Quy ước bộ nhớ: render() NHẬN QUYỀN SỞ HỮU dec.L/dec.R — xử lý tại chỗ khi được, và đặt dec.L = dec.R = null ngay khi không còn dùng
// để trình duyệt thu hồi sớm. Các vòng lặp dài chia khối + nhường luồng (giao diện không đứng, hủy được, có tiến độ).
const BPM = 120, BLK = 1 << 20;
// No Effect: dùng thẳng PCM đã giải mã (không sao chép, không DSP)
const fx = (dec, P, cb) => P.none ? { length: dec.L.length, sampleRate: dec.rate, getChannelData: c => c ? dec.R : dec.L } : render(dec, P, cb);
const sub = (bar, a, b) => v => bar(a + (b - a) * v);   // tiến độ con của một giai đoạn

function biquadCoef(type, f0, Q, dB, fs) {
  f0 = Math.min(Math.max(f0, 10), fs * 0.45);   // luôn dưới Nyquist: file 8/16 kHz với EQ 8 kHz không làm bộ lọc mất ổn định
  Q = Math.max(Q, 0.1); dB = clampN(dB, -30, 30, 0);
  const A = Math.pow(10, dB / 40), w0 = 2 * Math.PI * f0 / fs, cw = Math.cos(w0), sw = Math.sin(w0), al = sw / (2 * Q), sq = 2 * Math.sqrt(A) * al;
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else if (type === 'pk') { b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; }
  else if (type === 'ls') { b0 = A * ((A + 1) - (A - 1) * cw + sq); b1 = 2 * A * ((A - 1) - (A + 1) * cw); b2 = A * ((A + 1) - (A - 1) * cw - sq); a0 = (A + 1) + (A - 1) * cw + sq; a1 = -2 * ((A - 1) + (A + 1) * cw); a2 = (A + 1) + (A - 1) * cw - sq; }
  else { b0 = A * ((A + 1) + (A - 1) * cw + sq); b1 = -2 * A * ((A - 1) + (A + 1) * cw); b2 = A * ((A + 1) + (A - 1) * cw - sq); a0 = (A + 1) - (A - 1) * cw + sq; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = (A + 1) - (A - 1) * cw - sq; }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
function biquadRun(x, [b0, b1, b2, a1, a2]) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = x[i], y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y; }
}
const EQS = {
  warm: [['ls', 120, 0.707, 4], ['hs', 8000, 0.707, -3]],
  bright: [['hs', 6000, 0.707, 4], ['ls', 100, 0.707, -1]],
  bass: [['ls', 100, 0.707, 7]],
  muffled: [['lp', 2500, 0.707, 0], ['lp', 2500, 0.707, 0]],
  radio: [['hp', 400, 0.707, 0], ['lp', 3400, 0.707, 0]],
};
// Echo ping-pong theo nhịp (120 BPM): 1 beat = 0.5 s. Hai đường trễ vòng (độ dài d) thay cho hai mảng cả bài.
const DELAYS = { e16: 0.125, e8: 0.25, d8: 0.375, q: 0.5, h: 1 };
async function delayFX(dec, P, bar) {
  const rate = dec.rate, n = dec.L.length, d = Math.round((DELAYS[P.dly] || 0) * rate), dmix = clampN(P.dmix, 0, 1, 0);
  if (!d || dmix <= 0 || !n) return dec;
  const fb = clampN(P.fb, 0, 0.9, 0.4);
  const need = Math.ceil(Math.log(0.001) / Math.log(Math.max(fb, 0.05)));   // số lần lặp để echo giảm 60 dB
  const reps = Math.max(1, Math.min(need, 60, Math.floor(30 * rate / d)));   // đuôi tối đa 30 s
  const len = n + d * reps, sL = dec.L, sR = dec.R, L = new Float32Array(len), R = new Float32Array(len);
  L.set(sL); R.set(sR);
  const rL = new Float32Array(d), rR = new Float32Array(d);
  let k = 0;   // k = i mod d: ô nhớ chứa eL/eR của thời điểm i-d
  for (let s = d; s < len; s += BLK) {
    const e = Math.min(len, s + BLK);
    for (let i = s; i < e; i++) {
      const j = i - d, m = j < n ? (sL[j] + sR[j]) * 0.5 : 0;
      const el = m + fb * rR[k], er = fb * rL[k];
      rL[k] = el; rR[k] = er; if (++k === d) k = 0;
      L[i] += dmix * el; R[i] += dmix * er;
    }
    bar((e - d) / (len - d)); await tick();
  }
  dec.L = dec.R = null;
  if (reps < need) { const fl = Math.min(len - n, Math.round(2 * rate)); for (let j = 0; j < fl; j++) { const g = j / fl; L[len - 1 - j] *= g; R[len - 1 - j] *= g; } }   // đuôi bị cắt vì giới hạn độ dài: tắt dần, không "cạch"
  return { rate, L, R };
}
// Reverb Schroeder/Freeverb: 8 comb + 4 allpass mỗi kênh. LFO sine điều khiển DECAY (RT60) và FILTER (damping).
const RV = {
  room_s: { name: 'Phòng nhỏ', rt: 0.6, damp: 0.45, pre: 5 },
  room:   { name: 'Phòng', rt: 1.2, damp: 0.35, pre: 10 },
  hall:   { name: 'Hall', rt: 2.2, damp: 0.30, pre: 20 },
  big:    { name: 'Hall lớn / nhà thờ', rt: 4.5, damp: 0.25, pre: 35 },
  plate:  { name: 'Plate (sáng)', rt: 1.8, damp: 0.12, pre: 0 },
  dark:   { name: 'Tối / ấm', rt: 2.5, damp: 0.60, pre: 20 },
};
async function reverbJS(dec, P, bar) {
  const rate = dec.rate, n = dec.L.length, R0 = RV[P.rv], mixP = clampN(P.mix, 0, 1, 0);
  if (!R0 || mixP <= 0 || !n) return { outL: dec.L, outR: dec.R };   // không reverb: giữ nguyên mảng, không sao chép
  const amt = clampN(P.revAmt, 0, 1, 0), RT0 = R0.rt * clampN(P.decay, 0.5, 2, 1), len = n + Math.ceil(Math.min(30, 1.75 * RT0 + 0.5) * rate);
  const outL = new Float32Array(len), outR = new Float32Array(len);
  outL.set(dec.L); outR.set(dec.R); dec.L = dec.R = null;   // bản khô nằm trong outL/outR cho tới bước trộn cuối: dùng làm đầu vào luôn
  const sc = rate / 44100;
  const mk = sp => ({
    c: [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map(d => { const L = Math.round((d + sp) * sc); return { b: new Float32Array(L), i: 0, f: 0, L, g: 0 }; }),
    a: [556, 441, 341, 225].map(d => { const L = Math.round((d + sp) * sc); return { b: new Float32Array(L), i: 0, L }; }),
  });
  const rv = [mk(0), mk(23)], wet = [new Float32Array(len), new Float32Array(len)];
  const w = 2 * Math.PI / (clampN(P.bars, 1, 16, 4) * 4 * 60 / BPM * rate);
  let damp = R0.damp;
  const B = 1 << 17;
  for (let s = 0; s < len; s += B) {
    const e = Math.min(len, s + B);
    for (let i = s; i < e; i++) {
      if ((i & 63) === 0) {
        const sn = Math.sin(w * i), rt = RT0 * Math.max(0.15, 1 + 0.75 * amt * sn);
        damp = Math.min(0.7, Math.max(0.05, R0.damp + 0.25 * amt * sn));
        for (let k = 0; k < 2; k++) for (let j = 0; j < 8; j++) { const c = rv[k].c[j]; c.g = Math.pow(10, -3 * c.L / (rate * rt)); }
      }
      const x = i < n ? (outL[i] + outR[i]) * 0.5 : 0;
      for (let k = 0; k < 2; k++) {
        const r = rv[k]; let acc = 0;
        for (let j = 0; j < 8; j++) {
          const c = r.c[j], o = c.b[c.i];
          c.f = o * (1 - damp) + c.f * damp; c.b[c.i] = x + c.f * c.g;
          if (++c.i === c.L) c.i = 0; acc += o;
        }
        for (let j = 0; j < 4; j++) {
          const q = r.a[j], bo = q.b[q.i], y = bo - acc;
          q.b[q.i] = acc + bo * 0.5; if (++q.i === q.L) q.i = 0; acc = y;
        }
        wet[k][i] = acc;
      }
    }
    bar(0.9 * e / len); await tick();
  }
  // mức wet = mix × mức RMS của bài gốc (giới hạn trên để đoạn im lặng + một tiếng động cuối bài không thổi tung phần reverb); cắt bass dưới 150 Hz; pre-delay theo loại phòng
  let sd = 0, sw = 0;
  for (let i = 0; i < n; i++) { sd += outL[i] * outL[i] + outR[i] * outR[i]; sw += wet[0][i] * wet[0][i] + wet[1][i] * wet[1][i]; }
  const scale = sw > 0 ? Math.min(24, Math.sqrt(sd / sw)) * mixP : 0;
  const pre = Math.round(R0.pre / 1000 * rate), a = Math.exp(-2 * Math.PI * 150 / rate), outs = [outL, outR];
  for (let k = 0; k < 2; k++) {
    let px = 0, py = 0; const W = wet[k], O = outs[k];
    for (let i = 0; i < len - pre; i++) { const x = W[i]; py = a * (py + x - px); px = x; O[i + pre] += py * scale; }
  }
  bar(1);
  return { outL, outR };
}
// 8D tự viết (không dùng HRTF của trình duyệt vì dễ "hạt/zipper" khi nguồn âm di chuyển).
// Phần giữa (L+R) đi theo quỹ đạo quanh đầu, phần bên (L-R) giữ nguyên để còn độ rộng stereo.
// Gồm: lệch thời gian hai tai (ITD, nội suy Catmull-Rom), tai xa bị tối và nhỏ, phía sau bị tối. Mọi thông số đổi mượt từng mẫu.
async function circle8d(outL, outR, rate, w, kind, str, bar) {
  const len = outL.length, D = 0.00066 * rate, m = new Float32Array(len), sd = new Float32Array(len);
  for (let i = 0; i < len; i++) { m[i] = (outL[i] + outR[i]) / 2; sd[i] = (outL[i] - outR[i]) / 2; }
  const at = pos => {
    const i0 = Math.floor(pos), f = pos - i0, a = m[i0 - 1] || 0, b = m[i0] || 0, c = m[i0 + 1] || 0, d = m[i0 + 2] || 0;
    return b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)));
  };
  const k1 = 2 * Math.PI * 1800 / rate, aS = k1 / (1 + k1), k2 = 2 * Math.PI * 5000 / rate, aR = k2 / (1 + k2);
  let sl = 0, sr = 0, rl = 0, rr = 0, c0 = 1;
  // quỹ đạo: trả về s (trái -1 … phải +1), gán c0 (sau -1 … trước +1)
  const path = th => {
    let s;
    switch (kind) {
      case 'circle_rev': s = -Math.sin(th); c0 = Math.cos(th); break;
      case 'swing_front': s = Math.sin(th); c0 = Math.sqrt(Math.max(0, 1 - s * s)); break;
      case 'swing_back': s = Math.sin(th); c0 = -Math.sqrt(Math.max(0, 1 - s * s)); break;
      case 'fig8': s = Math.sin(th); c0 = Math.sin(2 * th); break;
      case 'drift': s = 0.7 * Math.sin(th) + 0.3 * Math.sin(1.7 * th + 1); c0 = 0.7 * Math.cos(0.6 * th + 0.5) + 0.3 * Math.sin(1.3 * th + 2); break;
      default: s = Math.sin(th); c0 = Math.cos(th);
    }
    return s;
  };
  for (let st = 0; st < len; st += BLK) {
    const e = Math.min(len, st + BLK);
    for (let i = st; i < e; i++) {
      const s = path(w * i) * str, c = c0 * str;
      const qL = Math.max(0, s), qR = Math.max(0, -s), qB = Math.max(0, -c);
      let xl = at(i - D * qL), xr = at(i - D * qR);
      sl += aS * (xl - sl); xl += qL * (sl - xl);
      sr += aS * (xr - sr); xr += qR * (sr - xr);
      rl += aR * (xl - rl); xl += 0.8 * qB * (rl - xl);
      rr += aR * (xr - rr); xr += 0.8 * qB * (rr - xr);
      const rear = 1 - 0.25 * qB;
      outL[i] = xl * (1 - 0.5 * qL) * rear + sd[i];
      outR[i] = xr * (1 - 0.5 * qR) * rear - sd[i];
    }
    bar(e / len); await tick();
  }
}
const SHAPES = {
  sine: p => Math.sin(p),
  tri: p => (2 / Math.PI) * Math.asin(Math.sin(p)),
  sq: p => Math.tanh(3 * Math.sin(p)) / Math.tanh(3),
};
// Chuỗi: (đảo) → độ rộng/karaoke → EQ → echo → reverb → panner → fade. `bar(v)` nhận tiến độ 0..1 của cả chuỗi.
async function render(dec, P, bar = () => {}) {
  const rate = dec.rate, w = 2 * Math.PI / (clampN(P.bars, 1, 16, 4) * 4 * 60 / BPM * rate);
  let L = dec.L, R = dec.R; dec.L = dec.R = null;   // nhận quyền sở hữu
  if (P.rev === 'on') { L.reverse(); R.reverse(); }
  const width = clampN(P.width, 0, 2, 1), kara = clampN(P.kara, 0, 1, 0);
  if (width !== 1 || kara > 0) for (let s = 0; s < L.length; s += BLK) {
    const e = Math.min(L.length, s + BLK);
    for (let i = s; i < e; i++) { const m = (L[i] + R[i]) / 2 * (1 - kara), sd = (L[i] - R[i]) / 2 * width; L[i] = m + sd; R[i] = m - sd; }
    await tick();
  }
  const bands = [...(EQS[P.eq] || []), ['ls', 100, 0.707, P.bassdb], ['pk', 1000, 0.8, P.middb], ['hs', 8000, 0.707, P.trebdb]].filter(b => b[3] !== 0 || b[0] === 'lp' || b[0] === 'hp');
  for (let k = 0; k < bands.length; k++) {
    const [ty, f, q, g] = bands[k], c = biquadCoef(ty, f, q, g, rate);
    biquadRun(L, c); await tick(); biquadRun(R, c); await tick(); bar(0.05 * (k + 1) / bands.length);
  }
  let cur = await delayFX({ rate, L, R }, P, sub(bar, 0.05, 0.15));
  const { outL, outR } = await reverbJS(cur, P, sub(bar, 0.15, 0.75)), len = outL.length;
  const amtP = clampN(P.panAmt, 0, 1, 0);
  if (P.pmode !== 'off' && P.pmode !== 'lr' && amtP > 0) await circle8d(outL, outR, rate, w, P.pmode, amtP, sub(bar, 0.75, 0.95));
  else if (P.pmode === 'lr' && amtP > 0) {
    // Panner trái-phải: công thức StereoPanner của Web Audio (giữ nội dung, không mất kênh)
    const shape = SHAPES[P.pshape] || SHAPES.sine;
    for (let s = 0; s < len; s += BLK) {
      const e = Math.min(len, s + BLK);
      for (let i = s; i < e; i++) {
        const p = amtP * shape(w * i), x = p <= 0 ? p + 1 : p;
        const gl = Math.cos(x * Math.PI / 2), gr = Math.sin(x * Math.PI / 2), l = outL[i], r = outR[i];
        if (p <= 0) { outL[i] = l + r * gl; outR[i] = r * gr; } else { outL[i] = l * gl; outR[i] = r + l * gr; }
      }
      bar(0.75 + 0.2 * e / len); await tick();
    }
  }
  const fi = Math.round(clampN(P.fin, 0, 60, 0) * rate), fo = Math.round(clampN(P.fout, 0, 60, 0) * rate);   // fade in / out (cosine)
  for (let i = 0; i < Math.min(fi, len); i++) { const g = 0.5 - 0.5 * Math.cos(Math.PI * i / fi); outL[i] *= g; outR[i] *= g; }
  for (let i = 0; i < Math.min(fo, len); i++) { const g = 0.5 - 0.5 * Math.cos(Math.PI * i / fo); outL[len - 1 - i] *= g; outR[len - 1 - i] *= g; }
  bar(1);
  return { length: len, sampleRate: rate, getChannelData: c => c ? outR : outL };
}
// Chuẩn hóa đỉnh rồi ghi WAV float32 (không hạ bit ở đây). Giá trị không hữu hạn → 0. Trả Uint8Array (writeFile sẽ chuyển quyền sở hữu, không sao chép lần nữa).
async function toWavF32(buf, targetDb, norm, bar = () => {}) {
  const n = buf.length, L = buf.getChannelData(0), R = buf.getChannelData(1);
  let peak = 0;
  for (let s = 0; s < n; s += BLK * 4) {
    const e = Math.min(n, s + BLK * 4);
    for (let i = s; i < e; i++) { const a = Math.abs(L[i]), b = Math.abs(R[i]); if (a - a === 0 && a > peak) peak = a; if (b - b === 0 && b > peak) peak = b; }
    await tick();
  }
  let gain = peak > 0 ? Math.pow(10, clampN(targetDb, -60, 6, 0) / 20) / peak : 1;
  if (norm === 'down') gain = Math.min(1, gain);      // chỉ hạ, không nâng nhiễu nền của bản gốc
  const bytes = new ArrayBuffer(44 + n * 8), v = new DataView(bytes), out = new Float32Array(bytes, 44, n * 2);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 8, true); w(8, 'WAVEfmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 3, true); v.setUint16(22, 2, true);
  v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 8, true); v.setUint16(32, 8, true); v.setUint16(34, 32, true);
  w(36, 'data'); v.setUint32(40, n * 8, true);
  for (let s = 0; s < n; s += BLK) {
    const e = Math.min(n, s + BLK);
    for (let i = s; i < e; i++) { const l = L[i] * gain, r = R[i] * gain; out[2 * i] = l - l === 0 ? l : 0; out[2 * i + 1] = r - r === 0 ? r : 0; }
    bar(e / n); await tick();
  }
  return new Uint8Array(bytes);
}
