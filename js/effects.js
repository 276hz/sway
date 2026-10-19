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
  const w = 2 * Math.PI / (clampN(P.period, 1, 120, 8) * rate);
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
// ---- 8D ----
// Quỹ đạo nguồn âm quanh đầu (nhìn từ trên xuống). Trả [s, c]: s = trái(-1) … phải(+1), c = sau(-1) … trước(+1). Dùng chung cho DSP và hình minh họa.
const ORBITS = ['circle', 'circle_rev', 'swing_front', 'swing_back', 'fig8', 'drift'];
function orbitAt(kind, th) {
  switch (kind) {
    case 'circle_rev': return [-Math.sin(th), Math.cos(th)];
    case 'swing_front': { const s = Math.sin(th); return [s, Math.sqrt(Math.max(0, 1 - s * s))]; }
    case 'swing_back': { const s = Math.sin(th); return [s, -Math.sqrt(Math.max(0, 1 - s * s))]; }
    case 'fig8': return [Math.sin(th), Math.sin(2 * th)];
    case 'drift': return [0.7 * Math.sin(th) + 0.3 * Math.sin(1.7 * th + 1), 0.7 * Math.cos(0.6 * th + 0.5) + 0.3 * Math.sin(1.3 * th + 2)];
    default: return [Math.sin(th), Math.cos(th)];
  }
}
// 8D tự viết (không dùng HRTF của trình duyệt vì dễ "hạt/zipper" khi nguồn âm di chuyển, và kết quả khác nhau giữa các trình duyệt).
// Mô hình đầu hình cầu kiểu Brown & Duda (1998): (1) độ trễ giữa hai tai theo công thức Woodworth (tối đa ≈ 0,66 ms), nội suy Catmull-Rom;
// (2) "bóng đầu": bộ lọc 1 cực/1 zero theo góc giữa nguồn âm và trục từng tai (tai xa bị mất âm cao, tai gần sáng hơn một chút);
// (3) phía sau tối hơn và nhỏ hơn (tham số rear); (4) khoảng cách (dist): hấp thụ âm cao + giảm mức.
// Phần giữa (L+R) đi theo quỹ đạo, phần bên (L−R) giữ nguyên để còn độ rộng stereo. Mọi thông số đổi mượt, cập nhật mỗi 8 mẫu.
const A_HEAD = 0.0875, C_SOUND = 343;   // bán kính đầu (m), tốc độ âm thanh (m/s)
const angDiff = (a, b) => { const d = a - b; return Math.abs(((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI); };
// hệ số bộ lọc bóng đầu: α(θ) = 1,05 + 0,95·cos(1,2·θ); α > 1 (tai gần) chỉ giữ một nửa mức tăng để không làm sáng bản nhạc
const shadowAlpha = (theta, str) => { let a = 1.05 + 0.95 * Math.cos(1.2 * theta); if (a > 1) a = 1 + (a - 1) * 0.5; return 1 + (a - 1) * str; };
async function circle8d(outL, outR, rate, w, kind, o, bar) {
  const len = outL.length, m = new Float32Array(len), sd = new Float32Array(len), str = o.str;
  for (let i = 0; i < len; i++) { m[i] = (outL[i] + outR[i]) / 2; sd[i] = (outL[i] - outR[i]) / 2; }
  const at = pos => {
    const i0 = Math.floor(pos), f = pos - i0, a = m[i0 - 1] || 0, b = m[i0] || 0, c = m[i0 + 1] || 0, d = m[i0 + 2] || 0;
    return b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)));
  };
  const k = rate * A_HEAD / C_SOUND, a1 = (1 - k) / (1 + k), dMax = A_HEAD / C_SOUND * rate;   // k = fs/ω0
  const kr = 2 * Math.PI * 5000 / rate, aR = kr / (1 + kr), kd = 2 * Math.PI * (18000 - 14400 * o.dist) / rate, aD = kd / (1 + kd), distG = 1 / (1 + 0.8 * o.dist);
  let hxl = 0, hyl = 0, hxr = 0, hyr = 0, rl = 0, rr = 0, dl = 0, dr = 0;
  let dL = 0, dR = 0, bl0 = 1, bl1 = 0, br0 = 1, br1 = 0, qL = 0, qR = 0, mixR = 0, gain = 1;
  for (let st = 0; st < len; st += BLK) {
    const e = Math.min(len, st + BLK);
    for (let i = st; i < e; i++) {
      if ((i & 7) === 0) {   // cập nhật thông số vị trí (tốc độ xoay chậm hơn nhiều so với 8 mẫu)
        const [su, cu] = orbitAt(kind, w * i + o.phase), az = Math.atan2(su, cu), lat = Math.asin(Math.max(-1, Math.min(1, su)));
        const tau = dMax * (Math.abs(lat) + Math.abs(su)) * str;   // Woodworth: (a/c)(θ + sin θ)
        dL = su > 0 ? tau : 0; dR = su < 0 ? tau : 0; qL = Math.max(0, su) * str; qR = Math.max(0, -su) * str;
        const aRt = shadowAlpha(angDiff(az, Math.PI / 2), str), aLf = shadowAlpha(angDiff(az, -Math.PI / 2), str);
        br0 = (1 + aRt * k) / (1 + k); br1 = (1 - aRt * k) / (1 + k); bl0 = (1 + aLf * k) / (1 + k); bl1 = (1 - aLf * k) / (1 + k);
        const qB = Math.max(0, -cu * str); mixR = o.rear * qB; gain = (1 - 0.3125 * o.rear * qB) * distG;
      }
      const xl = at(i - dL), xr = at(i - dR);
      let yl = bl0 * xl + bl1 * hxl - a1 * hyl; hxl = xl; hyl = yl;
      let yr = br0 * xr + br1 * hxr - a1 * hyr; hxr = xr; hyr = yr;
      if (mixR > 0) { rl += aR * (yl - rl); yl += mixR * (rl - yl); rr += aR * (yr - rr); yr += mixR * (rr - yr); }
      if (o.dist > 0) { dl += aD * (yl - dl); yl = dl; dr += aD * (yr - dr); yr = dr; }
      outL[i] = yl * (1 - 0.35 * qL) * gain + sd[i];
      outR[i] = yr * (1 - 0.35 * qR) * gain - sd[i];
    }
    bar(e / len); await tick();
  }
}
const SHAPES = {
  sine: p => Math.sin(p),
  tri: p => (2 / Math.PI) * Math.asin(Math.sin(p)),
  sq: p => Math.tanh(3 * Math.sin(p)) / Math.tanh(3),
};
// ---- MAX dB (maximizer): đo độ to (ITU-R BS.1770: K-weighting + gating) → gain bù RIÊNG cho từng bài → limiter nhìn trước (lookahead) ----
// Nhạc càng nhỏ càng được nâng nhiều; nhưng mức nén đỉnh bị chặn trên (maxGR) để không "bẹp" nhạc có nhiều động. Đỉnh KHÔNG BAO GIỜ vượt trần.
const KW = fs => {   // hai biquad K-weighting cho mọi sample rate: [b0, b1, b2, a1, a2]
  let f0 = 1681.974450955533, Q = 0.7071752369554196, K = Math.tan(Math.PI * f0 / fs), a0 = 1 + K / Q + K * K;
  const Vh = Math.pow(10, 3.999843853973347 / 20), Vb = Math.pow(Vh, 0.4996667741545416);
  const pre = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
  f0 = 38.13547087602444; Q = 0.5003270373238773; K = Math.tan(Math.PI * f0 / fs); a0 = 1 + K / Q + K * K;
  return [pre, [1, -2, 1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]];
};
const kStep = (c, z, o, v) => { const y = c[0] * v + z[o]; z[o] = c[1] * v - c[3] * y + z[o + 1]; z[o + 1] = c[2] * v - c[4] * y; return y; };   // biquad dạng transposed II
// Độ to tích hợp (LUFS) + đỉnh mẫu. lufs = -Infinity nếu im lặng / dữ liệu không hợp lệ.
async function measureLoud(L, R, rate) {
  const n = L.length, hop = Math.max(1, Math.round(0.1 * rate)), [pre, rlb] = KW(rate), z = new Float64Array(8), hops = [];
  let peak = 0, acc = 0, cnt = 0;
  for (let s = 0; s < n; s += BLK) {
    const e = Math.min(n, s + BLK);
    for (let i = s; i < e; i++) {
      const l = L[i], r = R[i], a = Math.abs(l), b = Math.abs(r);
      if (a > peak) peak = a; if (b > peak) peak = b;
      const yl = kStep(rlb, z, 2, kStep(pre, z, 0, l)), yr = kStep(rlb, z, 6, kStep(pre, z, 4, r));
      acc += yl * yl + yr * yr; if (++cnt === hop) { hops.push(acc / hop); acc = 0; cnt = 0; }
    }
    await tick();
  }
  if (cnt > 0 && hops.length < 4) hops.push(acc / cnt);   // file ngắn hơn 0,4 s: coi như một khối
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length, LK = e => -0.691 + 10 * Math.log10(e), blocks = [];
  if (hops.length < 4) { if (hops.length) blocks.push(avg(hops)); } else for (let j = 0; j + 4 <= hops.length; j++) blocks.push((hops[j] + hops[j + 1] + hops[j + 2] + hops[j + 3]) / 4);
  const g1 = blocks.filter(e => LK(e) > -70);   // cổng tuyệt đối -70 LUFS
  if (!g1.length) return { lufs: -Infinity, peak };
  const g2 = g1.filter(e => LK(e) > LK(avg(g1)) - 10);   // cổng tương đối -10 LU
  const lufs = g2.length ? LK(avg(g2)) : LK(avg(g1));
  return { lufs: lufs - lufs === 0 ? lufs : -Infinity, peak };
}
// Nội suy 4× (3 pha giữa hai mẫu, sinc cửa sổ Hann 8 điểm) để dò ĐỈNH THẬT (true peak, ITU-R BS.1770) — đỉnh nằm giữa các mẫu có thể cao hơn đỉnh mẫu tới ~1–3 dB
const TPH = [0.25, 0.5, 0.75].map(ph => { const h = []; let sum = 0; for (let k = -3; k <= 4; k++) { const x = k - ph, v = (Math.sin(Math.PI * x) / (Math.PI * x)) * 0.5 * (1 + Math.cos(Math.PI * x / 4)); h.push(v); sum += v; } return h.map(v => v / sum); });
// Một tầng limiter nhìn trước, liên kết stereo (không lệch hình âm): gain G đặt trước → đỉnh không vượt `ceil`.
// atk = thời gian nhìn trước/attack (giây), relS = release (giây), tp = dò đỉnh thật. Xử lý tại chỗ.
async function limitPass(L, R, rate, G, ceil, atk, relS, tp, bar) {
  const n = L.length, N = Math.max(1, Math.round(atk * rate)), rel = 1 - Math.exp(-1 / (relS * rate)), r = new Float32Array(n);   // r[i] = hệ số giảm cần để mẫu i không vượt trần
  for (let s = 0; s < n; s += BLK) {
    const e = Math.min(n, s + BLK);
    for (let i = s; i < e; i++) {
      const l = Math.abs(L[i]), rr = Math.abs(R[i]); let a = (l > rr ? l : rr) * G;
      if (tp && i >= 3 && i + 4 < n && a * 2.5 > ceil) {   // chỉ nội suy khi cạnh trần (bỏ qua chỗ còn cách trần > 8 dB)
        for (let q = 0; q < 3; q++) { const h = TPH[q]; let u = 0, w = 0; for (let k = 0; k < 8; k++) { u += h[k] * L[i - 3 + k]; w += h[k] * R[i - 3 + k]; } u = Math.abs(u) * G; w = Math.abs(w) * G; if (u > a) a = u; if (w > a) a = w; }
      }
      r[i] = a > ceil ? ceil / a : 1;
    }
    await tick();
  }
  bar(0.4);
  // m[i] = min r[i..i+N] (cửa sổ trượt, hàng đợi đơn điệu, duyệt ngược)
  const cap = N + 2, dv = new Float32Array(cap), di = new Int32Array(cap); let head = 0, tail = 0, size = 0;
  for (let hi = n; hi > 0; hi -= BLK) {
    for (let i = hi - 1, lo = Math.max(0, hi - BLK); i >= lo; i--) {
      const v = r[i];
      while (size && dv[(tail - 1 + cap) % cap] >= v) { tail = (tail - 1 + cap) % cap; size--; }
      dv[tail] = v; di[tail] = i; tail = (tail + 1) % cap; size++;
      while (di[head] > i + N) { head = (head + 1) % cap; size--; }
      r[i] = dv[head];
    }
    await tick();
  }
  bar(0.7);
  // b[i] = trung bình N giá trị m gần nhất (attack mượt, luôn ≤ r[i]) → release một cực → áp gain
  const ring = new Float32Array(N).fill(r[0]); let sum = r[0] * N, k = 0, env = 1;
  for (let s = 0; s < n; s += BLK) {
    const e = Math.min(n, s + BLK);
    for (let i = s; i < e; i++) {
      const m = r[i]; sum += m - ring[k]; ring[k] = m; if (++k === N) k = 0;
      const b = Math.min(1, sum / N); env = b < env ? b : env + (b - env) * rel;
      const g = G * env, l = L[i] * g, rr = R[i] * g;
      L[i] = l > ceil ? ceil : l < -ceil ? -ceil : l; R[i] = rr > ceil ? ceil : rr < -ceil ? -ceil : rr;
    }
    bar(0.7 + 0.3 * e / n); await tick();
  }
}
// amt 0..1 (0 = tắt), ceilDb = trần ĐỈNH THẬT (dBTP). Xử lý tại chỗ; trả {lufsIn, gainDb} hoặc null nếu không làm gì (im lặng).
// Hai tầng: (A) limiter CHẬM (nhìn trước 15 ms, release 350 ms) nhận phần lớn việc nén → ít bơm/méo; (B) limiter NHANH dò đỉnh thật (5 ms / 120 ms) giữ trần tuyệt đối.
async function maximize(L, R, rate, amt, ceilDb, bar = () => {}) {
  const n = L.length; amt = clampN(amt, 0, 1, 0);
  if (!n || amt <= 0) return null;
  const hp = biquadCoef('hp', 20, 0.707, 0, rate);   // bỏ sub-bass < 20 Hz: không nghe thấy nhưng ăn headroom
  biquadRun(L, hp); await tick(); biquadRun(R, hp); await tick(); bar(0.05);
  const { lufs, peak } = await measureLoud(L, R, rate); bar(0.2);
  if (!(lufs > -Infinity) || !(peak > 0)) return null;
  const cd = clampN(ceilDb, -9, -0.1, -1), ceil = Math.pow(10, cd / 20), peakDb = 20 * Math.log10(peak);
  const target = -16 + 10 * amt, maxGR = 2.5 + 6.5 * amt;   // 100% → mục tiêu ≈ -6 LUFS, chấp nhận tối đa ≈ 9 dB nén đỉnh
  const gPk = cd - peakDb;   // gain vừa đủ để đỉnh chạm trần (chưa cần limiter): nâng tới đó là "miễn phí" về chất lượng
  const gDb = Math.max(0, Math.min(Math.max(target - lufs, gPk), gPk + maxGR, 36));
  await limitPass(L, R, rate, Math.pow(10, gDb / 20), ceil * Math.pow(10, 4 / 20), 0.015, 0.35, false, v => bar(0.2 + 0.35 * v));
  await limitPass(L, R, rate, 1, ceil, 0.005, 0.12, true, v => bar(0.55 + 0.45 * v));
  return { lufsIn: lufs, gainDb: gDb };
}
// Chuỗi: (đảo) → độ rộng/karaoke → EQ → echo → reverb → panner → fade → MAX dB. `bar(v)` nhận tiến độ 0..1 của cả chuỗi.
async function render(dec, P, bar = () => {}) {
  const rate = dec.rate, w = 2 * Math.PI / (clampN(P.period, 1, 120, 8) * rate);   // LFO / quỹ đạo: P.period giây mỗi vòng
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
  if (ORBITS.includes(P.pmode) && amtP > 0) await circle8d(outL, outR, rate, w, P.pmode, { str: amtP, phase: clampN(P.phase, 0, 360, 0) * Math.PI / 180, rear: clampN(P.rear, 0, 1, 0.8), dist: clampN(P.dist, 0, 1, 0) }, sub(bar, 0.75, 0.95));
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
  if (clampN(P.maxdb, 0, 1, 0) > 0) await maximize(outL, outR, rate, P.maxdb, clampN(P.peak, -9, -0.1, -1) - (FORMATS[P.fmt] && FORMATS[P.fmt].lossy ? 1 : 0), sub(bar, 0.95, 1));   // định dạng nén (MP3/AAC…): chừa thêm 1 dB cho sai số mã hóa   // khâu cuối: đặt sau mọi hiệu ứng khác
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
