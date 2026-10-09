# Sway

Công cụ chuyển đổi âm thanh/video chạy **hoàn toàn trong trình duyệt** (ffmpeg.wasm + Web Audio), kèm hơn 40 preset hiệu ứng (8D, slowed + reverb, nightcore…). Không có backend, không có bước build: thư mục này chính là thứ được deploy lên Cloudflare Pages.

Ngôn ngữ: 中文 (chính, `/`), English (`/en/`), Tiếng Việt (`/vi/`).

## Cấu trúc

| Đường dẫn | Vai trò |
|---|---|
| `index.html`, `en/`, `vi/`, `404.html`, `sitemap.xml`, `robots.txt` | **File sinh ra** từ `tools/index.template.html` + `js/i18n-data.js` bằng `node tools/build-pages.mjs`. Đừng sửa tay. |
| `js/config.js` | Phiên bản ffmpeg ghim, danh sách CDN, SRI, cờ `vendor`. Dùng chung cho trang và `sw.js`. |
| `js/core.js` | `$`, dòng trạng thái đổi-ngôn-ngữ-được (`status(() => …)`), tiến độ, `UserError`, tên file an toàn, `tick()`. |
| `js/i18n-data.js`, `js/i18n.js` | Toàn bộ chuỗi giao diện (một khóa → 3 ngôn ngữ), `t()`. |
| `js/formats.js` | Định dạng đầu ra, dòng lệnh ffmpeg (`buildArgs`), đọc WAV, bộ lọc giải mã, giới hạn bộ nhớ. |
| `js/effects.js` | DSP thuần JS: EQ, echo, reverb, 8D, panner, ghi WAV float32. |
| `js/presets.js`, `js/controls.js` | Preset và bảng điều khiển nâng cao (dựng từ mảng `CTL`). |
| `js/ffmpeg.js` | Nạp ffmpeg.wasm (một lần, hủy được), thăm dò file, giải mã, canh treo. |
| `js/zip.js` | CRC32 + ZIP kiểu store. `js/app.js`: trạng thái, xử lý theo lô, nghe thử, tải xuống. |
| `sw.js`, `manifest.webmanifest`, `_headers` | PWA, cache, header bảo mật của Cloudflare Pages. |
| `tools/` | Công cụ phát triển (không cần khi chạy): sinh trang, kiểm thử, tạo icon, tính SRI. |

## Luồng xử lý một file

`File → ffmpeg: probe (-i in) → giải mã 1 lượt ra WAV float32 stereo (đã gồm tách cắt/lọc/tốc độ/cao độ…) → JS: DSP → WAV float32 → ffmpeg: resample + dither + mã hóa + ghép tag/ảnh bìa → Blob`.

- Sample rate gốc được giữ tới bước cuối; resample/dither/hạ bit chỉ xảy ra **một lần** ở bước mã hóa.
- Mọi thông số vào DSP/dòng lệnh đều được ép về khoảng hợp lệ; NaN/±Infinity được chặn ở đầu vào và đầu ra.
- Các vòng lặp DSP chạy theo khối và nhường luồng chính (giao diện không đứng, hủy được, có tiến độ).

## Bộ nhớ (đọc kỹ nếu xử lý file dài)

PCM sau giải mã là float32 stereo: **8 byte × sample rate × số giây** (≈ 21 MB mỗi phút ở 44,1 kHz) — lớn hơn file nén rất nhiều, nên giới hạn phụ thuộc **thời lượng**, không phải dung lượng file. Hệ thống không hứa một con số RAM cố định vì mỗi trình duyệt/thiết bị khác nhau.

- Vòng đời: `nạp → giải mã → DSP (tại chỗ) → ghi WAV → [giải phóng PCM ở luồng chính] → mã hóa → đọc kết quả → xóa file ảo`.
- `render()` nhận quyền sở hữu mảng PCM; echo dùng bộ đệm vòng; không còn bản sao thừa. Trong lúc ffmpeg mã hóa, luồng chính không còn giữ PCM (đo: giữ ~1× thay vì ~3×).
- Xử lý **tuần tự** từng file; sau file nặng (> ~6 phút stereo) ffmpeg được giải phóng vì bộ nhớ wasm không bao giờ co lại.
- Cảnh báo mềm theo `navigator.deviceMemory` (iOS/Safari coi là thiết bị nhỏ). Chặn cứng chỉ khi vượt giới hạn kỹ thuật (mảng ~2 GB, file nguồn > 1,8 GB) — thông báo nêu số phút của file.
- Kết quả giữ dưới dạng Blob để tải/ZIP; ZIP ghép Blob (không sao chép), CRC tính theo khúc 4 MB khi cần. ZIP cổ điển giới hạn ~4 GB (có thông báo).

## Deploy lên Cloudflare Pages

1. Kết nối repo, **Framework preset: None**, **Build command: để trống**, **Build output directory: `/`** (gốc repo).
2. `_headers` được Pages áp dụng tự động (CSP, HSTS, cache `no-cache` cho HTML/JS/CSS/`sw.js`…).
3. Nếu không muốn công khai `README.md`, `tools/`: dùng build command `mkdir dist && cp -r css js en vi *.html *.png *.svg *.webmanifest *.xml *.txt _headers sw.js dist/` và output `dist` (các file đó đã có `X-Robots-Tag: noindex`).
4. Đổi tên miền: sửa `SITE` trong `tools/build-pages.mjs`, chạy `node tools/build-pages.mjs` (cập nhật canonical, hreflang, Open Graph, sitemap, robots).
5. Sau khi sửa chuỗi trong `js/i18n-data.js` hoặc template: chạy lại `node tools/build-pages.mjs` (`--check` để kiểm tra, đã nằm trong `tools/check.mjs`).

## Cập nhật ffmpeg

Sửa **một chỗ**: `js/config.js` (`ffmpeg`, `core`, `worker`). Service worker tự đặt tên cache thư viện theo các phiên bản này, nên đổi phiên bản mới tải lại lõi; **nâng phiên bản app thì không phải tải lại 30 MB**. Lõi 31 MB vượt giới hạn 25 MiB/file của Pages nên giữ trên CDN (jsDelivr → mirror fastly → unpkg, đều ghim phiên bản). Nạp theo cặp UMD (worker cổ điển + lõi UMD); nếu khởi tạo lỗi sẽ thử lõi ESM trên cùng CDN.

- **SRI**: khi có mạng chạy `node tools/sri.mjs`, dán khối `sri` vào `js/config.js` → trình duyệt từ chối bản bị thay đổi.
- **Tự host**: đặt `ffmpeg-core.js`, `ffmpeg-core.wasm`, `814.ffmpeg.js` (bản `dist/umd`) vào `vendor/` (cùng nguồn, hoặc proxy), đặt `vendor: true` trong `config.js`. Chỉ khả thi khi host cho phép file > 25 MiB.

## PWA và offline

- Vỏ ứng dụng (HTML/CSS/JS/icon) được cache khi cài; **ưu tiên mạng**, có bản lưu thì chỉ chờ 4 giây rồi dùng bản lưu → không kẹt ở bản cũ, mạng yếu không treo trang. Khi `sw.js` đổi, trang hiện thanh “có bản mới”.
- Lõi ffmpeg (~30 MB) và font tải ở lần dùng đầu và được cache riêng. **Lần đầu cần mạng để chuyển đổi**; sau đó chuyển đổi chạy được khi offline (trình duyệt vẫn có thể xóa cache — khi đó cần tải lại; app báo rõ).
- Khi đổi danh sách `SHELL` trong `sw.js`, đổi `SHELL_V` (hiện `sway-shell-v16`). `tools/check.mjs` kiểm tra `SHELL` khớp các file có thật.

## Bảo mật

CSP thiết kế theo kiến trúc thật: script từ chính site + CDN ghim phiên bản + `blob:` (worker/lõi do trang tạo) + `'wasm-unsafe-eval'` (biên dịch WebAssembly, không mở `eval` JS); không inline script/style. Không dùng SharedArrayBuffer nên không cần COOP/COEP cho ffmpeg. Thêm `X-Frame-Options`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: no-referrer`, HSTS, COOP, Permissions-Policy. Tên file/tag/chuỗi người dùng chỉ đi vào DOM qua `textContent` và vào ffmpeg qua argv (không qua shell); tên file đầu ra và tên trong ZIP được làm sạch (ký tự cấm, độ dài theo byte, trùng tên không phân biệt hoa/thường).

## Metadata

Tag văn bản của file gốc được giữ (hoặc xóa toàn bộ) và có thể ghi đè từng trường. Ảnh bìa nhúng/thay được với **MP3, FLAC, AAC/M4A, ALAC**. OGG/Opus/MP2/WMA/WAV/AIFF/AC3: không nhúng được ảnh bìa; WAV/AIFF/AC3 chỉ có vài tag cơ bản — giao diện báo rõ. Mức hỗ trợ thực tế còn tùy trình phát; không có cam kết “100%”.

## MP4/MKV “giữ hình gốc”

Hình được **copy**, âm thanh được xử lý lại. Nếu cài đặt làm đổi độ dài/điểm bắt đầu của âm thanh (tốc độ, cắt, bỏ khoảng lặng, đảo ngược, ghép cặp) thì video sẽ lệch tiếng-hình: giao diện hiện cảnh báo ngay khi chọn và nhắc lại sau khi xong. Reverb/echo chỉ làm đuôi âm dài hơn hình (có ghi chú). Âm có độ trễ khởi đầu riêng trong container (offset PTS) không được bù.

## Kiểm thử

```bash
node tools/check.mjs      # tĩnh + DSP + ZIP + pipeline thật với ffmpeg gốc nếu có trong PATH (không cần npm)
NODE_PATH=$(npm root -g) node tools/ui-test.mjs   # tùy chọn: Chromium headless (Playwright), ffmpeg giả lập, CSP thật
python3 tools/make-assets.py   # tạo lại icon PNG và og.png (cần Pillow)
```

## Giới hạn còn lại (do trình duyệt/nền tảng)

- Không có “bộ nhớ tối đa” đảm bảo: tab iOS Safari bị giết khi quá tải; file dài trên điện thoại có thể thất bại dù đã có cảnh báo.
- ffmpeg.wasm đơn luồng nên mã hóa/giải mã chậm hơn bản gốc nhiều lần; khi tab bị khóa màn hình/chuyển nền trên iOS tác vụ có thể bị tạm dừng (app xin Wake Lock khi trình duyệt hỗ trợ).
- Tải xuống bằng `blob:` tự động sau thao tác dài có thể bị Safari chặn: nút ZIP chuyển sang “Tải ZIP” để bấm lần nữa.
- Bộ mã hóa có sẵn phụ thuộc bản `@ffmpeg/core` (báo lỗi rõ nếu thiếu).
