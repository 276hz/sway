// Sway: CRC32 + ZIP kiểu "store" (không nén). ZIP cổ điển (không ZIP64): mỗi offset/kích thước ≤ 32-bit, tối đa 65534 file.
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32Update = (c, u) => { for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return c; };
// CRC của một Blob theo từng khúc 4 MB: không nạp cả file vào bộ nhớ JS, chỉ tính khi thật sự cần tạo ZIP
async function crc32Blob(blob, onP) {
  let c = ~0; const CH = 4 << 20;
  for (let o = 0; o < blob.size; o += CH) {
    c = crc32Update(c, new Uint8Array(await blob.slice(o, o + CH).arrayBuffer()));
    onP && onP(Math.min(1, (o + CH) / blob.size)); await tick();
  }
  return ~c >>> 0;
}
const ZMAX = 0xFFFFFFFF - 2 ** 20;   // chừa chỗ cho thư mục trung tâm
// Tên duy nhất trong ZIP (không phân biệt hoa/thường: Windows và macOS coi "A.mp3" và "a.mp3" là một file)
function uniqueName(name, used) {
  const m = name.match(/^(.*?)(\.[^.]*)?$/), base = m[1], ext = m[2] || '';
  let n = name, k = 1;
  while (used.has(n.toLowerCase())) n = fileSafe(base + ` (${k++})`, ext.slice(1));
  used.add(n.toLowerCase()); return n;
}
// files: [{ name, blob, crc, size }] — name đã qua fileSafe + uniqueName
async function zipStore(files, onP) {
  const enc = new TextEncoder(), parts = [], cd = []; let off = 0, cdLen = 0;
  if (files.length > 65534) throw new Error('zip-limit');
  const d = new Date(), dosD = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), dosT = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  for (let i = 0; i < files.length; i++) {
    const f = files[i], nm = enc.encode(f.name), sz = f.size;
    if (off + 30 + nm.length + sz > ZMAX) throw new Error('zip-limit');
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(10, dosT, true); h.setUint16(12, dosD, true);
    h.setUint32(14, f.crc, true); h.setUint32(18, sz, true); h.setUint32(22, sz, true); h.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(h.buffer), nm, f.blob);          // Blob ghép Blob: không sao chép dữ liệu vào bộ nhớ JS
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(12, dosT, true); c.setUint16(14, dosD, true);
    c.setUint32(16, f.crc, true); c.setUint32(20, sz, true); c.setUint32(24, sz, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    cd.push(new Uint8Array(c.buffer), nm); off += 30 + nm.length + sz; cdLen += 46 + nm.length;
    onP && onP((i + 1) / files.length); await tick();
  }
  if (off + cdLen > ZMAX) throw new Error('zip-limit');
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, cdLen, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...cd, new Uint8Array(e.buffer)], { type: 'application/zip' });
}
