# Sway

Công cụ chuyển đổi âm thanh/video chạy **hoàn toàn trong trình duyệt** (ffmpeg.wasm + Web Audio), kèm hơn 40 preset hiệu ứng (8D, slowed + reverb, nightcore…), 19 định dạng đầu ra và bảng chỉnh thông số có "Chỉnh nhanh". Không có backend, không có bước build: thư mục này chính là thứ được deploy lên Cloudflare Pages.

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

## Định dạng

- **Đầu vào:** mọi thứ ffmpeg giải mã được (MP3, WAV, FLAC, M4A/AAC, OGG, Opus, **WMA**, AIFF, AC3, AMR, APE, WavPack, MP4, MOV, MKV, WebM, AVI…).
- **Đầu ra không mất dữ liệu:** FLAC, WAV (16/24/32f), AIFF, ALAC (M4A), WavPack, CAF·ALAC.
- **Đầu ra nén:** MP3 (CBR/VBR), AAC/M4A, **M4R** (nhạc chuông iPhone, tối đa 40 giây), AAC ADTS (`.aac`), OGG Vorbis, Opus, WebM·Opus, AC3, E-AC3, MP2, **WMA**.
- **Giữ hình gốc:** MP4, MKV.
- Mỗi định dạng khai báo bộ mã hóa + muxer cần có (`need` trong `js/formats.js`). Ngay sau khi nạp ffmpeg, app chạy `-encoders`/`-muxers` để biết bản `@ffmpeg/core` đang dùng **thật sự có** gì; định dạng thiếu bị khóa trong danh sách (không để người dùng chờ rồi mới báo lỗi). Thêm định dạng mới = thêm một mục vào `FORMATS`, `FGROUPS` và chuỗi dịch `fmt.*`.

## 8D "chuẩn" và cách Sway làm

8D thực chất là xử lý **binaural** (nghe bằng tai nghe): nguồn âm đi vòng quanh đầu trên mặt phẳng ngang. Công thức cổ điển của các công cụ 8D: **6–12 giây một vòng** (≈ 0,1 Hz), **độ sâu quỹ đạo** lớn, **reverb 15–30%**, đôi khi thêm chút bass. Sway làm đúng như vậy nhưng bằng mô hình đầu hình cầu (Brown & Duda) thay vì chỉ đảo trái-phải:

1. **Độ trễ giữa hai tai** theo Woodworth, `(a/c)(θ + sin θ)`, tối đa ≈ 0,66 ms, nội suy Catmull-Rom.
2. **"Bóng đầu"**: bộ lọc 1 cực/1 zero theo góc giữa nguồn âm và trục từng tai — tai xa mất âm cao, tai gần sáng hơn một chút.
3. **Phía sau tối hơn và nhỏ hơn** (`rear`), **khoảng cách** (`dist`: hấp thụ âm cao + giảm mức), **góc bắt đầu** (`phase`), **chu kỳ** tính bằng giây (`period`) và cường độ/bán kính quỹ đạo (`panAmt`).
4. Phần giữa (L+R) đi theo quỹ đạo; phần bên (L−R) giữ nguyên nên stereo không bị xẹp. 6 quỹ đạo: tròn, tròn ngược, lắc phía trước/sau, số 8, trôi ngẫu nhiên (`orbitAt()` trong `js/effects.js`, dùng chung cho DSP và hình minh họa).

Preset: `8D vòng tròn` (chuẩn, 8 s), `8D hội trường` (10 s), `8D sát tai`, `8D xa và rộng`, `8D + bass`, `8D chậm`, `8D nhanh`, ngược chiều, số 8, trôi… `tools/check.mjs` kiểm chứng bằng xung đơn: trễ ≈ 28,9 mẫu ở 44,1 kHz khi nguồn ở bên, tai xa nhỏ hơn, hai tai bằng nhau khi nguồn ở phía trước, và chu kỳ/chiều quay đúng.

## MAX dB (nhạc nhỏ → to tối đa)

Preset `MAX dB` (nhóm "Phổ biến"), `MAX dB 8D DISTRIBUTION` (nhóm "8D và không gian": 8D vòng tròn 8 s + reverb hội trường + MAX dB) và thanh trượt `maxdb` (0–100%, hiện ở "Chỉnh nhanh") dùng khâu cuối của chuỗi DSP — `maximize()` trong `js/effects.js`, không phải phép nhân gain mù quáng:

1. **Bỏ sub-bass < 20 Hz** (không nghe thấy nhưng ăn headroom).
2. **Đo độ to cả bài** theo ITU-R BS.1770 (K-weighting + cổng -70 LUFS / -10 LU) — khớp `ffmpeg ebur128` trong ±0,3 LU (`tools/check.mjs`, mục 3c).
3. **Gain riêng cho từng bài**: luôn nâng ít nhất tới mức đỉnh chạm trần (một gain cố định cho cả bài → giữ nguyên chênh lệch giữa các đoạn, "miễn phí" về chất lượng); nhạc nhỏ/nhiều động được nâng thêm tới mục tiêu ≈ -6 LUFS ở 100% (≈ -11 LUFS ở 50%) và chấp nhận tối đa ≈ 9 dB nén đỉnh (≈ 5,5 dB ở 50%). Trần gain +36 dB để không khuếch đại nhiễu nền của file gần như im lặng.
4. **Hai tầng limiter**: tầng chậm (nhìn trước 15 ms, release 350 ms) nhận phần lớn việc nén → ít bơm/méo; tầng nhanh (5 ms / 120 ms) giữ trần tuyệt đối. Cả hai **liên kết stereo** → không lệch hình âm, giữ nguyên chuyển động 8D (có kiểm thử).
5. **Trần là ĐỈNH THẬT (true peak, nội suy 4×)**, không chỉ đỉnh mẫu — đúng chuẩn khi tải lên Spotify/YouTube/Apple Music. Có kiểm thử bằng tín hiệu có đỉnh nội suy cao hơn đỉnh mẫu 3 dB (không dò đỉnh thật sẽ ra +0,3 dBTP, có dò thì -1,0 dBTP, đo bằng `ffmpeg ebur128`). Trần lấy từ ô "Đỉnh tối đa" (mặc định -1 dBTP); với định dạng nén (MP3/AAC/Opus/…) tự chừa thêm 1 dB cho sai số mã hóa.
6. Preset đi kèm nén nhẹ (`comp: soft`) trước khi đẩy. Nhạc đã to sẵn không bị làm nhỏ đi.

Muốn **chỉ nhân gain, không nén gì** (giữ đúng khoảng cách giữa các đoạn): kéo "MAX dB" xuống ~20–30% và tắt "Nén động", hoặc dùng "Chuẩn hóa đỉnh: Luôn kéo đỉnh về mức tối đa". Gợi ý xuất FLAC/WAV 24-bit hoặc MP3 320 / AAC. Giới hạn: file nguồn rất nhiễu sẽ bị nâng cả nhiễu nền.

## Chỉnh thông số sau khi chọn preset

- **Chỉnh nhanh**: các núm chính của preset (chu kỳ, độ sâu, reverb, tốc độ… tối đa 5, chọn tự động từ chính các giá trị preset đặt — `quickIds()` trong `js/presets.js`) được đưa ra ngay dưới danh sách preset. Đó là **cùng một** điều khiển với bảng nâng cao (di chuyển DOM, không nhân đôi), nên luôn đồng bộ. Chỉnh tay → preset thành "tùy chỉnh" nhưng Chỉnh nhanh vẫn giữ nguyên; **Hoàn lại preset** đưa mọi thứ về giá trị gốc.
- **Preset của tôi**: "Lưu thành preset của tôi" lưu toàn bộ thông số hiệu ứng vào `localStorage` (`sway.mypresets.v1`; dữ liệu đọc ra được kiểm tra lại: tên ≤ 40 ký tự, chỉ nhận điều khiển đã biết). Có trong danh sách preset, xóa được, nhớ qua lần mở sau.
- **Hình quỹ đạo** nhìn từ trên xuống cho kiểu chuyển động đang chọn; khi **Nghe thử**, chấm nguồn âm chạy đúng theo âm thanh.
- Các điều khiển chỉ hiện khi có nghĩa (ví dụ "tối khi ở sau"/"khoảng cách"/"góc bắt đầu" chỉ hiện với quỹ đạo 8D).

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
- Khi đổi danh sách `SHELL` trong `sw.js`, đổi `SHELL_V` (hiện `sway-shell-v17`). `tools/check.mjs` kiểm tra `SHELL` khớp các file có thật.

## Bảo mật

CSP thiết kế theo kiến trúc thật: script từ chính site + CDN ghim phiên bản + `blob:` (worker/lõi do trang tạo) + `'wasm-unsafe-eval'` (biên dịch WebAssembly, không mở `eval` JS); không inline script/style. Không dùng SharedArrayBuffer nên không cần COOP/COEP cho ffmpeg. Thêm `X-Frame-Options`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: no-referrer`, HSTS, COOP, Permissions-Policy. Tên file/tag/chuỗi người dùng chỉ đi vào DOM qua `textContent` và vào ffmpeg qua argv (không qua shell); tên file đầu ra và tên trong ZIP được làm sạch (ký tự cấm, độ dài theo byte, trùng tên không phân biệt hoa/thường).

## Metadata

Tag văn bản của file gốc được giữ (hoặc xóa toàn bộ) và có thể ghi đè từng trường. Ảnh bìa nhúng/thay được với **MP3, FLAC, AAC/M4A, ALAC, M4R**. OGG/Opus/WebM/MP2/WMA/WavPack/WAV/AIFF/AC3/E-AC3/CAF/ADTS: không nhúng được ảnh bìa; WAV/AIFF/AC3/E-AC3/CAF/ADTS chỉ có vài tag cơ bản — giao diện báo rõ. Mức hỗ trợ thực tế còn tùy trình phát; không có cam kết “100%”.

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
