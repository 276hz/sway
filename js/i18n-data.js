// Sway: UI strings + preset/advanced translations (pure data)
// ---- i18n: D[khóa] = [中文， English, Tiếng Việt]. Khóa thiếu bản dịch sẽ rơi về chuỗi tiếng Việt gốc trong mã ----
const LC = { zh: 'zh-CN', en: 'en', vi: 'vi' }, LI = { zh: 0, en: 1, vi: 2 };
const D = {
  title: ["Sway · 音频视频格式转换，在线转 FLAC、MP3、WAV，支持 8D 环绕效果", "Sway · Audio & video converter with 8D and reverb effects", "Sway · Chuyển file âm thanh, video sang FLAC, MP3, WAV, thêm hiệu ứng 8D"],
  desc: ["免费的浏览器端工具：将 mp3、mp4、wav、flac 等转换为 FLAC、MP3、WAV、AAC、Opus，并可添加 8D、混响、声像效果。文件不会上传到服务器。", "Free in-browser tool: convert mp3, mp4, wav, flac and more to FLAC, MP3, WAV, AAC or Opus, with 8D, reverb and panner effects. Files never leave your device.", "Công cụ miễn phí chạy ngay trên trình duyệt: chuyển mp3, mp4, wav, flac… sang FLAC, MP3, WAV, AAC, Opus và thêm hiệu ứng 8D, reverb, panner. Không tải file lên server."],
  "nav.privacy": ["隐私", "Privacy", "Riêng tư"],
  "nav.faq": ["常见问题", "FAQ", "Hỏi đáp"],
  h1a: ["音频与视频转换。", "Convert audio and video.", "Chuyển đổi âm thanh và video."],
  h1b: ["快速、私密、无需上传。", "Fast, private, no upload.", "Nhanh, riêng tư, không tải lên."],
  lede: ["支持常见音频和视频格式，内置 40 多种效果，如 8D 和混响。全程在你的浏览器中运行。", "Supports popular audio and video formats with 40+ presets such as 8D and reverb. Runs entirely in your browser.", "Hỗ trợ các định dạng âm thanh và video phổ biến, kèm hơn 40 mẫu hiệu ứng như 8D và reverb. Chạy hoàn toàn trong trình duyệt của bạn."],
  drop0: ["将音频或视频文件拖到这里", "Drop audio or video files here", "Thả file âm thanh hoặc video vào đây"],
  drop1: ["继续拖入更多文件", "Drop more files here", "Thả thêm file vào đây"],
  pick: ["或从设备选择", "or choose from your device", "hoặc chọn từ máy"],
  fmts: ["MP3 · WAV · FLAC · M4A · OGG · OPUS · MP4 · MOV · MKV · WEBM 等常见格式", "MP3 · WAV · FLAC · M4A · OGG · OPUS · MP4 · MOV · MKV · WEBM and other popular formats", "MP3 · WAV · FLAC · M4A · OGG · OPUS · MP4 · MOV · MKV · WEBM và các định dạng phổ biến khác"],
  adv: ["高级", "Advanced", "Nâng cao"],
  effect: ["效果", "Effect", "Hiệu ứng"],
  outfmt: ["输出格式", "Output format", "Định dạng đầu ra"],
  custom: ["自定义（已手动调整）", "Custom (edited)", "Tùy chỉnh (đã chỉnh tay)"],
  "d.custom": ["已手动调整部分参数。", "Some parameters were adjusted manually.", "Đã chỉnh tay một số thông số."],
  go: ["转换", "Convert", "Chuyển đổi"],
  cancel: ["取消", "Cancel", "Hủy"],
  prev: ["试听", "Preview", "Nghe thử"],
  stop: ["停止", "Stop", "Dừng"],
  idle: ["在你的设备上处理，不会上传任何内容。", "Processed on your device. Nothing is uploaded.", "Xử lý trên máy bạn. Không có gì được tải lên."],
  sel: ["已选择 {n} 个文件。选择效果和格式后点击“转换”。", "{n} file(s) selected. Choose an effect and format, then press Convert.", "{n} file đã chọn. Chọn hiệu ứng và định dạng rồi bấm Chuyển đổi."],
  done: ["完成 {a}/{b} 个文件。", "Done {a}/{b} files.", "Xong {a}/{b} file."],
  cancelled: ["已取消", "Cancelled", "Đã hủy"],
  wait: ["等待中", "Waiting", "Đang chờ"],
  dl: ["下载 · {s}", "Download · {s}", "Tải xuống · {s}"],
  rm: ["移除文件", "Remove file", "Xóa file"],
  big: ["“{f}”较长或较大，处理时可能占用大量内存；设备内存较小时可能失败，建议逐个处理。", "“{f}” is long or large and may use a lot of memory; it may fail on devices with little memory — consider processing files one at a time.", "“{f}” khá dài hoặc lớn, có thể dùng nhiều bộ nhớ; trên máy ít bộ nhớ có thể thất bại — nên xử lý từng file."],
  zip0: ["下载全部 ZIP", "Download all as ZIP", "Tải tất cả (ZIP)"],
  zip1: ["正在创建 ZIP… {p}%", "Creating ZIP… {p}%", "Đang tạo ZIP… {p}%"],
  zip2: ["下载 ZIP", "Download ZIP", "Tải ZIP"],
  zipE: ["创建 ZIP 失败（可能是内存不足）。请逐个下载文件，或减少文件数量后重试。", "Could not create the ZIP (possibly out of memory). Download the files one by one, or try with fewer files.", "Tạo ZIP thất bại (có thể thiếu bộ nhớ). Hãy tải từng file hoặc thử với ít file hơn."],
  zipBig: ["文件总大小超过 ZIP 4 GB 限制，请逐个下载。", "Total size exceeds the 4 GB ZIP limit — download the files one by one.", "Tổng dung lượng vượt giới hạn ZIP 4 GB, hãy tải từng file."],
  footer: ["Sway · ffmpeg.wasm · 全程在浏览器中运行", "Sway · ffmpeg.wasm · runs entirely in your browser", "Sway · ffmpeg.wasm · chạy hoàn toàn trong trình duyệt"],
  g0: ["常用", "Popular", "Phổ biến"],
  g1: ["8D 与空间感", "8D & space", "8D và không gian"],
  g2: ["人声与乐器", "Voice & instruments", "Giọng và nhạc cụ"],
  g3: ["速度与音高", "Speed & pitch", "Tốc độ và cao độ"],
  g4: ["Lo-fi 与复古", "Lo-fi & retro", "Lo-fi và retro"],
  g5: ["母带与工具", "Master & utility", "Master và tiện ích"],
  g6: ["其他", "Other", "Khác"],
  "p.none": ["无效果", "No Effect", "Không hiệu ứng"],
  "d.none": ["不做任何处理，仅解码并转换为所选格式。", "No processing: just decode and convert to the chosen format.", "Giữ nguyên âm thanh, chỉ chuyển sang định dạng đã chọn."],
  "p.flmobile": ["FL Mobile 原版", "FL Mobile original", "FL Mobile gốc"],
  "p.c8d": ["8D 环绕", "8D circle", "8D vòng tròn"],
  "p.slowed": ["Slowed + 混响", "Slowed + reverb", "Slowed + reverb"],
  "p.nightcore": ["Nightcore", "Nightcore", "Nightcore"],
  "p.bighall": ["梦幻大厅", "Dreamy big hall", "Hall lớn mơ màng"],
  pair2: ["需 2 个文件", "needs 2 files", "cần 2 file"],
  pairNeed: ["需要恰好选择 2 个文件", "Needs exactly 2 files", "Cần chọn đúng 2 file"],
  pairL: ["左声道", "Left channel", "Kênh trái"],
  pairR: ["右声道", "Right channel", "Kênh phải"],
  pairD: ["已合并到第 1 个文件的结果中", "Merged into the file 1 result", "Đã gộp vào kết quả của file 1"],
  pairOff: ["春夏需要恰好 2 个文件，已切换为“无效果”", "Spring–Summer needs exactly 2 files, switched to No Effect", "Xuân-Hạ cần đúng 2 file, đã chuyển về Không hiệu ứng"],
  wsl: ["转换器", "Converter", "Bộ chuyển đổi"],
  drop0c: ["点按此处选择音频或视频文件", "Tap to choose audio or video files", "Chạm để chọn file âm thanh hoặc video"],
  drop1c: ["点按添加更多文件", "Tap to add more files", "Chạm để thêm file"],
  upd: ["有新版本可用", "New version available", "Có phiên bản mới"],
  updb: ["刷新", "Reload", "Tải lại"],
  ust: ["个半音", "semitones", "bán cung"],
  us: ["秒", "s", "giây"],
  ffl: ["正在下载 ffmpeg…", "Downloading ffmpeg…", "Đang tải ffmpeg…"],
  ffs: ["正在启动 ffmpeg…", "Starting ffmpeg…", "Đang khởi động ffmpeg…"],
  fft: ["转换引擎启动超时，请重试。", "The converter engine took too long to start. Please try again.", "Bộ chuyển đổi khởi động quá lâu. Hãy thử lại."],
  ffe: ["无法加载转换引擎（ffmpeg）。请检查网络连接后重试；若所在网络限制了公共 CDN，请稍后再试或换一个网络。", "Could not load the converter engine (ffmpeg). Check your connection and try again; if your network blocks public CDNs, try again later or use another network.", "Không tải được bộ chuyển đổi (ffmpeg). Kiểm tra kết nối rồi thử lại; nếu mạng chặn CDN công cộng, hãy thử lại sau hoặc đổi mạng."],
  ffd: ["ffmpeg 长时间无响应（设备内存可能不足）。请换更短的文件，或关闭其他标签页后重试。", "ffmpeg stopped responding (the device may be out of memory). Use a shorter file or close other tabs and try again.", "ffmpeg không phản hồi (thiết bị có thể hết bộ nhớ). Hãy dùng file ngắn hơn hoặc đóng các tab khác rồi thử lại."],
  dec: ["正在解码（首次需下载约 30 MB）…", "Decoding (first run downloads ~30 MB)…", "Đang giải mã (lần đầu phải tải ~30 MB)…"],
  decE: ["无法解码此文件：可能没有音频轨道，或格式不受支持。请换一个文件再试。", "Could not decode this file: it may have no audio track or use an unsupported format. Try another file.", "Không giải mã được file: có thể không có âm thanh hoặc định dạng không được hỗ trợ. Hãy thử file khác."],
  fltE: ["无法应用滤镜（降噪 / 速度 / 音高 / 调制 / 压缩 / 裁剪）。请关闭部分高级选项后重试。", "Could not apply the filters (denoise / speed / pitch / modulation / compressor / trim). Turn off some advanced options and try again.", "Không áp dụng được bộ lọc (khử nhiễu / tốc độ / cao độ / điều chế / nén động / cắt). Hãy tắt bớt tùy chọn nâng cao rồi thử lại."],
  wavE: ["无法读取解码后的音频数据，请换一个文件再试。", "Could not read the decoded audio data. Try another file.", "Không đọc được dữ liệu âm thanh sau giải mã. Hãy thử file khác."],
  fx: ["正在应用效果…", "Applying effect…", "Đang áp hiệu ứng…"],
  exp: ["正在导出 ", "Exporting ", "Đang xuất "],
  expE: ["ffmpeg 无法导出此格式（可能缺少编码器或参数不兼容）。请换一种输出格式再试。", "ffmpeg could not export this format (the encoder may be missing or the settings incompatible). Try another output format.", "ffmpeg không xuất được định dạng này (có thể thiếu bộ mã hóa hoặc thông số không tương thích). Hãy thử định dạng khác."],
  huge: ["文件太大，浏览器无法载入处理。请先分割或压缩，再试一次。", "This file is too large for the browser to load. Split or compress it first, then try again.", "File quá lớn để trình duyệt nạp. Hãy tách hoặc nén nhỏ trước rồi thử lại."],
  oom: ["浏览器内存不足。请关闭其他标签页、换更短的文件，或逐个处理。", "The browser ran out of memory. Close other tabs, use a shorter file, or process files one at a time.", "Trình duyệt hết bộ nhớ. Hãy đóng các tab khác, dùng file ngắn hơn hoặc xử lý từng file."],
  pvb: ["正在生成试听…", "Building preview…", "Đang tạo bản nghe thử…"],
  pvp: ["正在播放前 20 秒试听；导出文件的响度与编码可能略有不同。", "Playing the first 20 seconds as a preview. Loudness and encoding of the exported file may differ slightly.", "Đang phát 20 giây đầu để nghe thử. Độ to và bộ mã hóa của file xuất ra có thể khác đôi chút."],
  vid: ["保留原画面（画面不重新编码）；兼容性取决于容器和原视频编码。", "The original picture is kept (not re-encoded); compatibility depends on the container and the video codec.", "Giữ nguyên hình gốc (không mã hóa lại hình); khả năng tương thích phụ thuộc vào container và codec video."],
  i0: ["能转换什么", "What it converts", "Chuyển đổi được gì"],
  i1: ["支持 MP3、WAV、FLAC、M4A、OGG、Opus、WMA、AIFF、MP4、MOV、MKV、WebM 等常见格式。可导出 FLAC、WAV、AIFF、ALAC、MP3、AAC、OGG、Opus、AC3、MP2、WMA，或保留画面的 MP4/MKV。内置 40 多种预设：8D、slowed + 混响、nightcore、卡拉OK……", "Accepts MP3, WAV, FLAC, M4A, OGG, Opus, WMA, AIFF, MP4, MOV, MKV, WebM and other popular formats. Exports FLAC, WAV, AIFF, ALAC, MP3, AAC, OGG, Opus, AC3, MP2, WMA, or MP4/MKV keeping the original picture. 40+ presets: 8D, slowed + reverb, nightcore, karaoke…", "Nhận MP3, WAV, FLAC, M4A, OGG, Opus, WMA, AIFF, MP4, MOV, MKV, WebM và nhiều định dạng khác. Xuất FLAC, WAV, AIFF, ALAC, MP3, AAC, OGG, Opus, AC3, MP2, WMA hoặc MP4/MKV giữ hình. Có hơn 40 mẫu: 8D, slowed + reverb, nightcore, karaoke…"],
  i2: ["隐私", "Privacy", "Riêng tư"],
  i3: ["解码、处理和导出都在浏览器内通过 ffmpeg.wasm 完成。你的音频文件不会发送到任何服务器，无需账号，免费。转换引擎和字体从公共 CDN 加载。", "Decoding, processing and export all happen in your browser via ffmpeg.wasm. Your audio files are never sent to any server. No account, free. The converter engine and fonts are loaded from public CDNs.", "Giải mã, xử lý và xuất file đều diễn ra trong trình duyệt bằng ffmpeg.wasm. File âm thanh của bạn không được gửi tới máy chủ nào, không cần tài khoản, miễn phí. Bộ chuyển đổi và phông chữ được tải từ CDN công cộng."],
  i4: ["常见问题", "FAQ", "Hỏi đáp"],
  i5: ["什么是 8D 音频？", "What is 8D audio?", "Âm thanh 8D là gì?"],
  i6: ["通过不断改变左右耳之间的时间差、音量和音色，让声音在戴耳机时仿佛绕着头部旋转。", "An effect that continuously shifts timing, level and tone between your ears so the sound seems to circle your head on headphones.", "Hiệu ứng làm âm thanh có vẻ xoay quanh đầu khi nghe bằng tai nghe, bằng cách đổi liên tục độ lệch thời gian, độ to và âm sắc giữa hai tai."],
  i7: ["我的文件会被上传吗？", "Are my files uploaded anywhere?", "File của tôi có bị gửi đi đâu không?"],
  i8: ["不会。解码、处理和导出全部在你的浏览器中完成。", "No. Everything is decoded, processed and exported inside your browser.", "Không. Toàn bộ việc giải mã, xử lý và xuất file diễn ra trong trình duyệt của bạn."],
  i9: ["选哪种格式音质最好？", "Which format gives the best quality?", "Chọn định dạng nào cho chất lượng tốt nhất?"],
  i10: ["FLAC 或 WAV 可保持原始音质；需要小体积时选 MP3 320 kbps 或 AAC。原文件是 mp3 时，导出 FLAC 也无法恢复已损失的音质。", "FLAC or WAV keep quality intact; MP3 320 kbps or AAC suit smaller files. Exporting an mp3 to FLAC cannot restore quality already lost.", "FLAC hoặc WAV giữ nguyên chất lượng. MP3 320 kbps hoặc AAC phù hợp khi cần file nhỏ. File gốc là mp3 thì xuất FLAC cũng không phục hồi được phần chất lượng đã mất."],
  i11: ["大文件能处理吗？", "Can it handle large files?", "File lớn có xử lý được không?"],
  i12: ["取决于设备内存：解码后的音频体积远大于原文件，并随时长增加。如提示内存不足，请换更短的文件或逐个处理；手机上建议处理较短的文件。", "It depends on your device memory: decoded audio takes far more space than the original file and grows with duration. If memory runs out, try a shorter file or one file at a time; on phones, prefer shorter files.", "Tùy bộ nhớ của thiết bị: âm thanh sau giải mã chiếm nhiều chỗ hơn file gốc rất nhiều và tăng theo thời lượng. Nếu báo hết bộ nhớ, hãy thử file ngắn hơn hoặc xử lý từng file; trên điện thoại nên dùng file ngắn."],
  i13: ["可以离线使用吗？", "Does it work offline?", "Dùng offline được không?"],
  i14: ["页面本身在首次访问后可离线打开。转换引擎（约 30 MB）在首次转换时下载并由浏览器缓存；如果你还没有联网转换过，则需要联网一次。浏览器可能清除缓存，届时需要重新下载。", "The page itself opens offline after your first visit. The converter engine (about 30 MB) is downloaded the first time you convert and cached by your browser; if you have never converted while online, you need a connection once. Browsers may clear the cache, in which case it is downloaded again.", "Trang mở được khi offline sau lần truy cập đầu. Bộ chuyển đổi (khoảng 30 MB) được tải ở lần chuyển đổi đầu tiên và trình duyệt lưu lại; nếu bạn chưa từng chuyển đổi khi có mạng thì cần kết nối một lần. Trình duyệt có thể xóa bộ nhớ đệm, khi đó sẽ tải lại."],
  tooLong: ["音频太长（约 {m} 分钟），解码后会超出浏览器可处理的范围。请先把它分割成较短的片段。", "This audio is too long (about {m} min) to process in a browser tab. Split it into shorter parts first.", "Âm thanh quá dài (khoảng {m} phút) để xử lý trong một tab trình duyệt. Hãy tách thành các đoạn ngắn hơn trước."],
  noAudio: ["没有可处理的音频。请检查起点 / 终点设置，或换一个文件。", "There is no audio to process. Check the start/end trim settings or try another file.", "Không có âm thanh để xử lý. Hãy kiểm tra mốc bắt đầu/kết thúc hoặc thử file khác."],
  net: ["网络出错，请检查连接后重试。", "A network error occurred. Check your connection and try again.", "Lỗi mạng. Hãy kiểm tra kết nối rồi thử lại."],
  ffo: ["当前处于离线状态，且尚未下载转换引擎。请联网一次（约 30 MB），之后即可离线使用。", "You are offline and the converter engine has not been downloaded yet. Connect once (about 30 MB); after that it works offline.", "Bạn đang offline và chưa tải bộ chuyển đổi. Hãy kết nối mạng một lần (khoảng 30 MB); sau đó dùng offline được."],
  errGeneric: ["处理失败。请重试，或换一种输出格式 / 更短的文件。", "Processing failed. Try again, choose another output format, or use a shorter file.", "Xử lý thất bại. Hãy thử lại, chọn định dạng khác hoặc dùng file ngắn hơn."],
  badCover: ["封面图片无法使用：请选择 JPG 或 PNG 图片（不超过 16 MB）。", "The cover image can’t be used: choose a JPG or PNG image (up to 16 MB).", "Không dùng được ảnh bìa: hãy chọn ảnh JPG hoặc PNG (tối đa 16 MB)."],
  pairVid: ["春夏只输出音频，请选择音频格式（不能选 MP4 / MKV）。", "Spring–Summer outputs audio only — choose an audio format (not MP4 / MKV).", "Xuân-Hạ chỉ xuất âm thanh — hãy chọn định dạng âm thanh (không chọn MP4 / MKV)."],
  waitBusy: ["正在处理，请稍后再添加文件。", "Processing is in progress — add files when it finishes.", "Đang xử lý — hãy thêm file sau khi xong."],
  noPv: ["此浏览器无法试听（不支持 Web Audio）。", "Preview is not available in this browser (no Web Audio support).", "Trình duyệt này không hỗ trợ nghe thử (thiếu Web Audio)."],
  outBig: ["已生成的文件占用较多内存，建议先逐个下载。", "The generated files are using a lot of memory — download them one by one first.", "Các file đã tạo đang chiếm nhiều bộ nhớ — nên tải từng file trước."],
  vsync: ["画面保持原样，但当前设置会改变音频的时长或起点（{r}），导出的视频将音画不同步。建议改选纯音频格式。", "The picture is kept as-is, but the current settings change the audio length or start ({r}), so the exported video will be out of sync. Choose an audio-only format instead.", "Hình được giữ nguyên nhưng cài đặt hiện tại làm đổi độ dài hoặc điểm bắt đầu của âm thanh ({r}), nên video xuất ra sẽ lệch tiếng và hình. Hãy chọn định dạng chỉ có âm thanh."],
  vsyncS: ["注意：视频的音画可能不同步。", "Note: the video’s audio may be out of sync with the picture.", "Lưu ý: tiếng và hình của video có thể bị lệch."],
  vtail: ["混响 / 回声会让音频比画面略长（尾音），画面结束后仍会有声音。", "Reverb / echo makes the audio slightly longer than the picture (tail), so sound continues after the picture ends.", "Reverb / echo làm âm thanh dài hơn hình một chút (đuôi âm), nên vẫn còn tiếng sau khi hình kết thúc."],
  rsSpeed: ["速度", "speed", "tốc độ"],
  rsTrim: ["裁剪起止", "start/end trim", "cắt đầu/cuối"],
  rsSil: ["裁剪静音", "silence trim", "cắt khoảng lặng"],
  rsRev: ["倒放", "reverse", "phát ngược"],
  rsPair: ["合并两个文件", "merging two files", "ghép hai file"],
  sep: ["、", ", ", ", "],
  mnLim: ["该格式只支持少量标签，部分播放器可能不显示。", "This format supports only a few tags, and some players may not show them.", "Định dạng này chỉ hỗ trợ một vài tag, một số trình phát có thể không hiển thị."],
  mnCover: ["该格式不能嵌入封面图片，仅保存文字标签。", "This format cannot embed cover art; only text tags are saved.", "Định dạng này không nhúng được ảnh bìa; chỉ lưu tag chữ."],
  ub: ["小节", "bars", "ô nhịp"],
  wsp: ["处理进度", "Progress", "Tiến độ"],
  langl: ["语言", "Language", "Ngôn ngữ"],
  ogt: ["Sway · 音频视频格式转换，支持 8D 环绕效果", "Sway · Audio & video converter with 8D effects", "Sway · Chuyển đổi âm thanh, video và hiệu ứng 8D"],
  ogd: ["免费，在浏览器中运行，文件不上传服务器。40 多种效果预设：8D、Slowed + 混响、Nightcore……", "Free, runs in your browser, files are never uploaded. 40+ effect presets: 8D, slowed + reverb, nightcore…", "Miễn phí, chạy trong trình duyệt, file không tải lên máy chủ. Hơn 40 mẫu hiệu ứng: 8D, slowed + reverb, nightcore…"],
  ogalt: ["Sway：浏览器端音频视频转换器", "Sway: in-browser audio and video converter", "Sway: bộ chuyển đổi âm thanh/video ngay trên trình duyệt"],
  ldd: ["在浏览器中转换音频和视频为 FLAC、MP3、WAV、AAC、Opus，并添加 8D、混响、声像效果。", "Convert audio and video to FLAC, MP3, WAV, AAC or Opus in your browser, with 8D, reverb and panner effects.", "Chuyển đổi âm thanh và video sang FLAC, MP3, WAV, AAC, Opus ngay trong trình duyệt, kèm hiệu ứng 8D, reverb, panner."],
  nf: ["页面不存在", "Page not found", "Không tìm thấy trang"],
  nfd: ["你访问的页面不存在。", "The page you requested does not exist.", "Trang bạn yêu cầu không tồn tại."],
  nfb: ["返回 Sway", "Back to Sway", "Về Sway"],
};
const PT = {}; `none|无效果|不做任何处理，仅转换为所选格式|No Effect|No processing, format conversion only
flmobile|FL Mobile 原版|左右声像加混响，还原 FL Mobile|FL Mobile original|Left-right panner plus reverb, as in FL Mobile
c8d|8D 环绕|声音绕头旋转（建议戴耳机）|8D circle|Sound circles your head (use headphones)
slowed|Slowed + 混响|放慢、变低沉，厚重混响|Slowed + reverb|Slower, deeper, thick reverb
nightcore|Nightcore|更快、更高、更明亮|Nightcore|Faster, higher and brighter
bighall|梦幻大厅|宽广如剧院，无声像|Dreamy big hall|Theater-sized space, no panning
c8d_slow|8D 慢速梦幻|缓慢旋转、大混响、温暖音色|Slow dreamy 8D|Slow rotation, big reverb, warm tone
c8d_fast|8D 快速|快速旋转，节奏感强|Fast 8D|Fast rotation, energetic
c8d_rev|8D 逆时针|逆时针旋转|Reverse 8D|Counter-clockwise rotation
swing|面前摆动|在面前左右摆动|Front swing|Swings side to side in front
fig8|环绕八字|绕头飞出“8”字|Figure-8|Flies in a figure-8 around your head
drift|随机漂移|轻柔地漂浮于空间中|Random drift|Gently drifts around the space
space|太空回声|悬浮于空间的回声|Space echo|Echoes floating through space
pingpong|乒乓立体声 + 回声|左右跳动并带回声|Ping-pong + echo|Bounces left and right with echo
cave|洞穴|深邃、昏暗、带回响|Cave|Deep, dark, with echoes
stadium|体育场|大空间混响加远处回声|Stadium|Big reverb with distant echoes
dream|梦幻（8D + 合唱）|轻柔旋转，浓厚闪烁|Dream (8D + chorus)|Soft rotation, thick and shimmering
podcast|播客 / 人声|降噪、压缩、-16 LUFS|Podcast / voice|Denoise, compress, -16 LUFS
karaoke|卡拉OK（消除人声）|削弱中间声道，即人声所在|Karaoke (vocal cut)|Reduces the center channel where vocals sit
vocal|突出人声|提升人声频段，轻度压缩|Vocal boost|Lifts the voice band, light compression
telephone|电话|窄带单声道，如电话通话|Telephone|Narrow mono sound like a phone call
megaphone|扩音喇叭|刺耳、窄带、略带回响|Megaphone|Harsh, narrow, slightly reverberant
deep|低沉嗓音|降低 4 个半音，速度不变|Deep voice|Down 4 semitones, same speed
chip|尖细嗓音（花栗鼠）|升高 7 个半音，速度不变|Chipmunk|Up 7 semitones, same speed
vapor|Vaporwave|慢速、低沉、合唱加大混响|Vaporwave|Slow, deep, chorus and big reverb
fast2|两倍速（保持音高）|加速 2 倍，音高不变|Double speed (keep pitch)|2× faster, pitch unchanged
slow2|半速（保持音高）|减速到 0.5 倍，音高不变|Half speed (keep pitch)|0.5× speed, pitch unchanged
down2|降 2 个半音|降低一个全音，速度不变|Down 2 semitones|One whole tone lower, same speed
up2|升 2 个半音|升高一个全音，速度不变|Up 2 semitones|One whole tone higher, same speed
lofi|Lo-fi 放松|温暖、略带噪点、放松|Lo-fi chill|Warm, slightly gritty, relaxed
radio|老式收音机|老收音机的窄带声音|Old radio|Narrow vintage radio sound
muffled|隔墙听（闷）|像从隔壁房间传来|Through a wall|Like listening from the next room
under|水下|昏暗、摇摆、带混响|Underwater|Dark, wobbly and reverberant
tape|老式磁带|轻微抖动、温暖、窄声场|Old cassette|Slight wobble, warm and narrow
stream14|流媒体标准（Spotify / YouTube）|轻度压缩，-14 LUFS|Streaming standard|Light compression, -14 LUFS
loud|响亮饱满|中度压缩，增强低音和高音|Loud and full|Medium compression, extra bass and treble
bassw|强劲低音 + 宽立体声|低音浓厚，立体声更宽|Heavy bass + wide stereo|Thick bass, wider stereo
wide|宽立体声|扩展左右声场|Wide stereo|Widens the left-right space
denoise|降噪|减少底噪和嗡嗡声|Denoise|Reduces hum and background hiss
reverse|倒放|整段音频倒转播放|Reverse|Plays the whole audio backwards
fade|淡入 3 秒，淡出 5 秒|平滑进入和结束|Fade in 3 s, out 5 s|Smooth start and end
xuanha|春夏|两个文件分开放在两边：第 1 个在左耳，第 2 个在右耳（需恰好选择 2 个文件）|Spring–Summer|Two files kept apart: file 1 in the left ear, file 2 in the right (needs exactly 2 files)`.split('\n').forEach(l => { const a = l.split('|'); PT[a[0]] = a.slice(1); });
// ---- Bảng "Nâng cao": TX[khóa] = [中文， English]. Khóa: nhãn = id; nhóm = 'g.' + id đầu nhóm; tùy chọn = 'id.giá trị' hoặc 'o.giá trị' dùng chung. Thiếu → giữ chữ Việt gốc ----
const TX = {}; `g.speed|速度 · 音高 · 音色 · 人声|Speed · pitch · tone · voice
g.fxm|调制 · 时间|Modulation · time
g.pmode|声像 · 空间|Panner · space
g.rv|混响|Reverb
g.dly|回声 / 延迟（乒乓，按 120 BPM 节拍）|Echo / delay (ping-pong, 120 BPM)
g.fmt|高级输出|Advanced output
speed|速度|Speed
spdm|变速方式|Speed mode
eq|音色（EQ）|Tone (EQ)
width|立体声宽度|Stereo width
semis|音高（速度不变）|Pitch (keep speed)
bassdb|低音|Bass
middb|中频（人声）|Mid (voice)
trebdb|高音|Treble
kara|削弱中置人声（卡拉OK）|Center cut (karaoke)
dn|降噪|Denoise
comp|动态压缩|Compressor
fxm|调制效果|Modulation effect
rev|倒放|Reverse
fin|淡入|Fade in
fout|淡出|Fade out
pmode|运动方式|Motion
pshape|LFO 波形（左 ↔ 右）|LFO shape (left ↔ right)
bars|LFO 周期|LFO cycle
panAmt|声像强度|Panner amount
rv|类型|Type
revAmt|LFO 幅度（衰减 + 滤波）|LFO amount (decay + filter)
mix|混响量|Reverb mix
decay|混响长度|Reverb length
dly|节拍长度|Note length
fb|反馈|Feedback
dmix|回声量|Echo mix
sr|采样率|Sample rate
depth|位深|Bit depth
kbps|码率|Bitrate
lufs|响度标准化（LUFS）|Loudness normalization (LUFS)
ch|声道|Channels
norm|峰值标准化|Peak normalization
peak|最大峰值|Max peak
o.off|关闭|Off
o.on|开启|On
o.soft|轻|Light
o.mid|中|Medium
o.hard|强|Strong
eq.none|保持原样|Unchanged
eq.warm|温暖|Warm
eq.bright|明亮|Bright
eq.bass|强劲低音|Heavy bass
eq.muffled|闷|Muffled
eq.radio|老式收音机|Old radio
spdm.pitch|同时改变音高（唱片式）|Change pitch too (vinyl-style)
spdm.keep|保持音高|Keep pitch
dn.10|轻|Light
dn.20|中|Medium
dn.30|强|Strong
fxm.lofi|Lo-fi（比特压缩）|Lo-fi (bitcrush)
pmode.lr|左 ↔ 右|Left ↔ right
pmode.circle|8D 圆周|8D circle
pmode.circle_rev|8D 逆时针圆周|8D circle (reverse)
pmode.swing_front|8D 面前摆动|8D front swing
pmode.swing_back|8D 身后摆动|8D back swing
pmode.fig8|8D 八字形|8D figure-8
pmode.drift|8D 随机漂移|8D random drift
pshape.sq|柔和方波|Soft square
rv.room_s|小房间|Small room
rv.room|房间|Room
rv.big|大厅 / 教堂|Big hall / cathedral
rv.plate|Plate（明亮）|Plate (bright)
rv.dark|暗 / 温暖|Dark / warm
dly.d8|附点 1/8|Dotted 1/8
sr.44100|44.1 kHz|44.1 kHz
sr.88200|88.2 kHz|88.2 kHz
sr.orig|与源文件相同|Same as source
depth.16|16-bit（含抖动）|16-bit (dithered)
lufs.-16|-16 LUFS（播客）|-16 LUFS (podcast)
lufs.-23|-23 LUFS（EBU 广播）|-23 LUFS (EBU broadcast)
ch.2|立体声|Stereo
ch.1|单声道|Mono
norm.down|仅在超限时降低（推荐）|Only lower if over the limit (recommended)
norm.full|始终提升到最大峰值|Always raise to max peak
fmt.mp4|MP4 · 保留原画面，音频 AAC|MP4 · keep original picture, AAC audio
fmt.mkv|MKV · 保留原画面，音频 FLAC|MKV · keep original picture, FLAC audio
g.gain|音频微调|Audio tweaks
g.mkeep|元数据（标签与封面）|Metadata (tags & cover)
gain|增益（音量）|Gain (volume)
hp|高通滤波|High-pass filter
lp|低通滤波|Low-pass filter
chm|声道处理|Channel mode
sil|裁剪静音|Trim silence
ts|起点（秒）|Start (seconds)
te|终点（秒，0 = 到结尾）|End (seconds, 0 = to the end)
vbr|MP3 质量模式|MP3 quality mode
mkeep|原有标签|Source tags
cmode|原有封面|Source cover
cover|替换封面（JPG/PNG）|Replace cover (JPG/PNG)
trauto|曲目编号|Track numbers
m_title|标题|Title
m_artist|艺术家|Artist
m_album|专辑|Album
m_albumartist|专辑艺术家|Album artist
m_year|年份|Year
m_genre|流派|Genre
m_track|曲目号|Track
m_disc|碟号|Disc
m_composer|作曲|Composer
m_comment|备注|Comment
chm.off|正常|Normal
chm.swap|左右互换|Swap L ↔ R
chm.left|仅左声道|Left channel only
chm.right|仅右声道|Right channel only
chm.inv|反转右声道相位|Invert R phase
sil.start|开头|Start
sil.end|结尾|End
sil.both|开头和结尾|Start and end
vbr.off|CBR（用下方码率）|CBR (bitrate below)
vbr.0|VBR V0（最佳）|VBR V0 (best)
mkeep.keep|保留|Keep
mkeep.strip|全部移除|Remove all
cmode.keep|保留|Keep
cmode.none|移除|Remove
trauto.keep|按填写|As entered
trauto.auto|按列表顺序编号|Auto-number
fmt.flac|FLAC（无损）|FLAC (lossless)
fmt.wav|WAV（无损）|WAV (lossless)
fmt.aiff|AIFF（无损）|AIFF (lossless)
fmt.alac|ALAC · M4A（无损）|ALAC · M4A (lossless)
rv.hall|音乐厅|Hall`.split('\n').forEach(l => { const a = l.split('|'); TX[a[0]] = a.slice(1); });
