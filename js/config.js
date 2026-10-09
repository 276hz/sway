// Sway: cấu hình dùng chung. Trang web nạp file này bằng <script>, sw.js nạp bằng importScripts().
// Phiên bản ffmpeg CHỈ khai báo ở đây (không rải nhiều nơi) để không bị lệch nhau.
const SWAY = {
  ffmpeg: '0.12.10',                 // @ffmpeg/ffmpeg: bản UMD + worker 814.ffmpeg.js (đi cùng đúng phiên bản này)
  core: '0.12.6',                    // @ffmpeg/core: lõi wasm đơn luồng (~30 MB), cặp tương thích với ffmpeg 0.12.x
  worker: '814.ffmpeg.js',           // tên chunk worker trong gói @ffmpeg/ffmpeg@0.12.10/dist/umd
  // true nếu bạn tự host ./vendor/{ffmpeg-core.js,ffmpeg-core.wasm,814.ffmpeg.js} (bản dist/umd) cùng nguồn với trang — xem README. Mặc định tắt: không gửi request thăm dò.
  vendor: false,
  // Thử lần lượt từng CDN (mirror jsDelivr trước, unpkg cuối). Mọi URL đều ghim phiên bản chính xác.
  cdn: ['https://cdn.jsdelivr.net/npm/', 'https://fastly.jsdelivr.net/npm/', 'https://unpkg.com/'],
  // SRI (tùy chọn). Điền bằng `node tools/sri.mjs` khi có mạng; để trống thì bỏ qua kiểm tra.
  // Khóa: 'ffmpeg.js' | 'worker' | 'core.js' | 'core.wasm'. Giá trị: 'sha384-...'
  sri: {},
};
