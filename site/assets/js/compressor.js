/*
 * devMmX PhotoTools — "Compress Image to a Target KB"
 * Everything runs in this browser tab. No network requests are made.
 * 1 KB = 1,024 bytes everywhere in this tool.
 */
(function () {
  'use strict';

  // ---------- Limits (change here if needed) ----------
  var KB = 1024;
  var MAX_FILE_BYTES = 25 * 1024 * 1024;   // 25 MB input file
  var MAX_PIXELS = 40000000;               // 40 megapixels
  var MAX_SIDE = 12000;                    // longest side in pixels
  var MIN_TARGET_KB = 5;
  var MAX_TARGET_KB = 20480;               // 20 MB
  var Q_MAX = 0.92;                        // best quality we try
  var Q_MIN = 0.10;                        // lowest quality we accept
  var Q_RESIZE = 0.70;                     // quality aimed for when shrinking dimensions
  var QUALITY_STEPS = 8;                   // binary-search steps per size
  var MAX_ENCODES = 40;                    // hard cap on JPEG encodes per run
  var MAX_RESIZE_ROUNDS = 6;
  var MIN_SIDE = 32;                       // never shrink below this (shortest side)
  var PREVIEW_SIDE = 640;                  // original preview size

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    tool: $('tool'),
    file: $('file-input'),
    original: $('original'),
    origName: $('orig-name'),
    origSize: $('orig-size'),
    origDims: $('orig-dims'),
    origType: $('orig-type'),
    origNote: $('orig-note'),
    origPreview: $('orig-preview'),
    alphaNote: $('alpha-note'),
    custom: $('custom-kb'),
    customBytes: $('custom-bytes'),
    allowResize: $('allow-resize'),
    compress: $('compress-btn'),
    reset: $('reset-btn'),
    status: $('status'),
    progress: $('progress'),
    error: $('error'),
    result: $('result'),
    resultHeading: $('result-heading'),
    resSize: $('res-size'),
    resTarget: $('res-target'),
    resDims: $('res-dims'),
    resQuality: $('res-quality'),
    resNote: $('res-note'),
    resPreview: $('res-preview'),
    download: $('download'),
    meterOrig: $('meter-orig'),
    meterRes: $('meter-res'),
    meterLimitA: $('meter-limit-a'),
    meterLimitB: $('meter-limit-b'),
    targets: document.querySelectorAll('input[name="target"]')
  };
  if (!el.tool) return;

  // ---------- State ----------
  var jobSeq = 0;            // bumps on every new image, reset or compress run
  var busy = false;          // true while loading or compressing
  var compressing = false;   // true only while compressing (options locked)
  var src = null;            // { draw: CanvasImageSource, width, height, close() }
  var srcFile = null;
  var srcInfo = null;
  var originalPreviewUrl = null;
  var resultUrl = null;

  function Cancelled() {}

  // ---------- Formatting ----------
  function fmtBytes(n) {
    return n.toLocaleString('en-US') + ' bytes';
  }
  function fmtKB(n) {
    var kb = n / KB;
    var d = kb < 10 ? 2 : 1;
    return kb.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' KB';
  }
  function fmtSize(n) { return fmtKB(n) + ' (' + fmtBytes(n) + ')'; }
  function fmtDims(w, h) { return w.toLocaleString('en-US') + ' × ' + h.toLocaleString('en-US') + ' px'; }

  // ---------- UI helpers ----------
  function setStatus(text) { el.status.textContent = text || ''; }
  function showError(html) {
    el.error.innerHTML = html;
    el.error.hidden = false;
  }
  function clearError() { el.error.hidden = true; el.error.textContent = ''; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function setProgress(value) {
    if (value === null) { el.progress.hidden = true; el.progress.removeAttribute('value'); return; }
    el.progress.hidden = false;
    el.progress.max = MAX_ENCODES;
    el.progress.value = value;
  }
  // `compressing` is true only while a compression run is active. During a run the
  // size and resize options are locked, so a result always matches what is selected.
  function setBusy(on, isCompressing) {
    busy = on;
    compressing = !!(on && isCompressing);
    el.compress.disabled = on || !src;
    for (var i = 0; i < el.targets.length; i++) el.targets[i].disabled = compressing;
    el.allowResize.disabled = compressing;
    updateCustomUi();
    el.tool.setAttribute('aria-busy', on ? 'true' : 'false');
  }

  function clearResult() {
    if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = null; }
    el.download.removeAttribute('href');
    el.download.removeAttribute('download');
    el.resPreview.removeAttribute('src');
    el.result.hidden = true;
  }

  function releaseSource() {
    if (src) { try { src.close(); } catch (e) { /* ignore */ } }
    src = null; srcFile = null; srcInfo = null;
    if (originalPreviewUrl) { URL.revokeObjectURL(originalPreviewUrl); originalPreviewUrl = null; }
    el.origPreview.removeAttribute('src');
    el.original.hidden = true;
    el.alphaNote.hidden = true;
    el.origNote.textContent = '';
  }

  // ---------- Target ----------
  function selectedTarget() {
    var checked = document.querySelector('input[name="target"]:checked');
    if (!checked) return { error: 'Choose a size limit.' };
    var kb;
    if (checked.value === 'custom') {
      var raw = el.custom.value.trim();
      if (!/^\d+$/.test(raw)) {
        return { error: 'Enter the custom limit as a whole number of KB, for example 75.' };
      }
      kb = parseInt(raw, 10);
      if (kb < MIN_TARGET_KB || kb > MAX_TARGET_KB) {
        return { error: 'The custom limit must be between ' + MIN_TARGET_KB + ' KB and ' + MAX_TARGET_KB.toLocaleString('en-US') + ' KB.' };
      }
    } else {
      kb = parseInt(checked.value, 10);
    }
    return { kb: kb, bytes: kb * KB };
  }

  function updateCustomUi() {
    var checked = document.querySelector('input[name="target"]:checked');
    var isCustom = checked && checked.value === 'custom';
    el.custom.disabled = !isCustom || compressing;
    var t = selectedTarget();
    el.customBytes.textContent = t.error ? '' : 'Selected limit: ' + t.kb.toLocaleString('en-US') + ' KB = ' + fmtBytes(t.bytes);
  }

  // ---------- File header inspection (before decoding) ----------
  function u16be(b, i) { return (b[i] << 8) | b[i + 1]; }
  function u32be(b, i) { return ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3]; }
  function u32le(b, i) { return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0; }
  function ascii(b, i, n) { var s = ''; for (var k = 0; k < n; k++) s += String.fromCharCode(b[i + k]); return s; }

  function sniff(b) {
    if (b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpeg';
    if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') return 'png';
    if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'webp';
    if (b.length >= 6 && ascii(b, 0, 3) === 'GIF') return 'gif';
    if (b.length >= 2 && ascii(b, 0, 2) === 'BM') return 'bmp';
    if (b.length >= 12 && ascii(b, 4, 4) === 'ftyp') {
      var brand = ascii(b, 8, 4);
      if (/^(heic|heix|hevc|heim|heis|mif1|msf1)$/.test(brand)) return 'heic';
      if (/^avi[fs]$/.test(brand)) return 'avif';
    }
    return null;
  }

  // Returns { type, width, height, alphaPossible } or { error }
  function inspect(b) {
    var type = sniff(b);
    if (type === 'heic') return { error: 'unsupported', detail: 'This is a HEIC/HEIF photo. Convert it to JPEG first (some phone camera or gallery apps have a JPEG or "most compatible" option), then try again.' };
    if (type === 'gif' || type === 'bmp' || type === 'avif') return { error: 'unsupported', detail: 'This is a ' + type.toUpperCase() + ' file. This tool accepts JPEG, PNG and WebP only.' };
    if (!type) return { error: 'unsupported', detail: 'This file is not a JPEG, PNG or WebP image. Renaming a file (for example .pdf to .jpg) does not change its format.' };

    if (type === 'png') {
      if (b.length < 33 || ascii(b, 12, 4) !== 'IHDR') return { error: 'corrupt' };
      var colorType = b[25];
      var hasTrns = indexOfAscii(b, 'tRNS', 33) !== -1;
      if (indexOfAscii(b, 'IEND', 33) === -1) return { error: 'corrupt', detail: 'The PNG file is incomplete. It may have been cut off while downloading or copying.' };
      return { type: 'png', width: u32be(b, 16), height: u32be(b, 20), alphaPossible: colorType === 4 || colorType === 6 || hasTrns };
    }

    if (type === 'webp') {
      var riffSize = u32le(b, 4);
      if (b.length < riffSize + 8) return { error: 'corrupt', detail: 'The WebP file is incomplete. It may have been cut off while downloading or copying.' };
      var chunk = ascii(b, 12, 4);
      if (chunk === 'VP8X' && b.length >= 30) {
        return { type: 'webp', width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)), alphaPossible: (b[20] & 0x10) !== 0 };
      }
      if (chunk === 'VP8 ' && b.length >= 30) {
        return { type: 'webp', width: (b[26] | (b[27] << 8)) & 0x3FFF, height: (b[28] | (b[29] << 8)) & 0x3FFF, alphaPossible: false };
      }
      if (chunk === 'VP8L' && b.length >= 25 && b[20] === 0x2F) {
        var bits = u32le(b, 21);
        return { type: 'webp', width: (bits & 0x3FFF) + 1, height: ((bits >> 14) & 0x3FFF) + 1, alphaPossible: true };
      }
      return { error: 'corrupt' };
    }

    // JPEG: walk the markers to find the frame header (SOF) and the scan (SOS)
    var i = 2, w = 0, h = 0, sos = -1;
    while (i + 4 <= b.length) {
      if (b[i] !== 0xFF) return { error: 'corrupt' };
      var m = b[i + 1];
      if (m === 0xFF) { i++; continue; }                        // fill byte
      if (m === 0xD8 || (m >= 0xD0 && m <= 0xD7) || m === 0x01) { i += 2; continue; }
      var len = u16be(b, i + 2);
      if (len < 2) return { error: 'corrupt' };
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
        if (i + 9 > b.length) return { error: 'corrupt' };
        h = u16be(b, i + 5); w = u16be(b, i + 7);
      }
      if (m === 0xDA) { sos = i + 2 + len; break; }
      i += 2 + len;
    }
    if (!w || !h || sos < 0 || sos > b.length) return { error: 'corrupt' };
    // A complete JPEG has an end marker (FF D9) after the image data.
    var foundEnd = false;
    for (var k = b.length - 2; k >= sos; k--) { if (b[k] === 0xFF && b[k + 1] === 0xD9) { foundEnd = true; break; } }
    if (!foundEnd) return { error: 'corrupt', detail: 'The JPEG file is incomplete. It may have been cut off while downloading or copying.' };
    return { type: 'jpeg', width: w, height: h, alphaPossible: false };
  }

  function indexOfAscii(b, str, from) {
    var c0 = str.charCodeAt(0);
    outer: for (var i = from; i <= b.length - str.length; i++) {
      if (b[i] !== c0) continue;
      for (var k = 1; k < str.length; k++) if (b[i + k] !== str.charCodeAt(k)) continue outer;
      return i;
    }
    return -1;
  }

  function dimsProblem(w, h) {
    if (!w || !h) return 'The image reports a width or height of zero, so it cannot be used.';
    if (w > MAX_SIDE || h > MAX_SIDE || w * h > MAX_PIXELS) {
      return 'This image is ' + fmtDims(w, h) + ' (' + (w * h / 1e6).toFixed(1) + ' megapixels). The limit is ' +
        (MAX_PIXELS / 1e6) + ' megapixels and ' + MAX_SIDE.toLocaleString('en-US') + ' px on the longest side, to avoid running out of phone memory. ' +
        'Crop or resize it with your gallery app first, or use a normal (not high-resolution) camera mode.';
    }
    return null;
  }

  // ---------- Decoding ----------
  function decode(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file).then(function (bmp) {
        return { draw: bmp, width: bmp.width, height: bmp.height, close: function () { bmp.close(); } };
      });
    }
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve({ draw: img, width: img.naturalWidth, height: img.naturalHeight, close: function () { img.src = ''; } });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }

  function toBlob(canvas, type, quality) {
    return new Promise(function (resolve) { canvas.toBlob(resolve, type, quality); });
  }

  // Small preview with transparency kept, plus a transparency check on the same pixels.
  function makePreview(source) {
    var scale = Math.min(1, PREVIEW_SIDE / Math.max(source.width, source.height));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(source.width * scale));
    c.height = Math.max(1, Math.round(source.height * scale));
    var ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source.draw, 0, 0, c.width, c.height);
    var hasAlpha = false;
    try {
      var data = ctx.getImageData(0, 0, c.width, c.height).data;
      for (var i = 3; i < data.length; i += 4) { if (data[i] < 255) { hasAlpha = true; break; } }
    } catch (e) { /* ignore */ }
    return toBlob(c, 'image/png').then(function (blob) {
      c.width = c.height = 0;
      return { blob: blob, hasAlpha: hasAlpha };
    });
  }

  // ---------- Loading a new image ----------
  function onFileChosen() {
    var file = el.file.files && el.file.files[0];
    var wasBusy = busy;
    var id = ++jobSeq;            // cancels any running job
    clearResult();
    releaseSource();
    clearError();
    setProgress(null);
    setBusy(false);
    if (!file) { setStatus(''); return; }

    setBusy(true);
    setStatus((wasBusy ? 'Stopped the previous run. ' : '') + 'Reading ' + file.name + '…');

    var fail = function (html) {
      if (id !== jobSeq) return;
      releaseSource();
      el.file.value = '';
      setStatus('');
      showError(html);
      setBusy(false);
    };

    if (file.size === 0) { fail('<p><strong>' + esc(file.name) + '</strong> is empty (0 bytes). Choose another file.</p>'); return; }
    if (file.size > MAX_FILE_BYTES) {
      fail('<p><strong>' + esc(file.name) + '</strong> is ' + fmtSize(file.size) + '. The largest file this tool accepts is ' + fmtKB(MAX_FILE_BYTES) + ' (25 MB).</p>');
      return;
    }

    file.arrayBuffer().then(function (buf) {
      if (id !== jobSeq) throw new Cancelled();
      var info = inspect(new Uint8Array(buf));
      buf = null;
      if (info.error === 'unsupported') { fail('<p>Unsupported file: <strong>' + esc(file.name) + '</strong>.</p><p>' + esc(info.detail) + '</p>'); throw new Cancelled(); }
      if (info.error === 'corrupt') {
        fail('<p><strong>' + esc(file.name) + '</strong> could not be read as an image.</p><p>' +
          esc(info.detail || 'The file looks damaged, or it is not really the format its name suggests.') + ' Try the original photo again.</p>');
        throw new Cancelled();
      }
      var problem = dimsProblem(info.width, info.height);
      if (problem) { fail('<p>Image too large: <strong>' + esc(file.name) + '</strong>.</p><p>' + esc(problem) + '</p>'); throw new Cancelled(); }
      setStatus('Opening the image…');
      return decode(file).then(function (decoded) {
        if (id !== jobSeq) { decoded.close(); throw new Cancelled(); }
        var p2 = dimsProblem(decoded.width, decoded.height);
        if (p2) { decoded.close(); fail('<p>' + esc(p2) + '</p>'); throw new Cancelled(); }
        return makePreview(decoded).then(function (prev) {
          if (id !== jobSeq) { decoded.close(); throw new Cancelled(); }
          src = decoded; srcFile = file; srcInfo = info;
          showOriginal(file, info, decoded, prev);
          setBusy(false);
          setStatus('Image ready. Choose a size limit, then press Compress.');
        });
      }, function (err) {
        if (err instanceof Cancelled) throw err;
        fail('<p><strong>' + esc(file.name) + '</strong> could not be opened. The file may be damaged, or your browser cannot decode it.</p>');
        throw new Cancelled();
      });
    }).catch(function (err) {
      if (err instanceof Cancelled) return;
      fail('<p>Something went wrong while reading the file. Please try again.</p>');
    });
  }

  function showOriginal(file, info, decoded, prev) {
    el.origName.textContent = file.name;
    el.origSize.textContent = fmtSize(file.size);
    el.origDims.textContent = fmtDims(decoded.width, decoded.height);
    el.origType.textContent = info.type.toUpperCase();
    originalPreviewUrl = URL.createObjectURL(prev.blob);
    el.origPreview.src = originalPreviewUrl;
    el.origPreview.alt = 'Preview of ' + file.name;
    el.alphaNote.hidden = !prev.hasAlpha;
    var t = selectedTarget();
    el.origNote.textContent = (info.type === 'jpeg' && !t.error && file.size <= t.bytes)
      ? 'This JPEG is already at or under ' + t.kb + ' KB. You may not need to compress it.' : '';
    el.original.hidden = false;
  }

  // ---------- Compression ----------
  function optionsKey() {
    var checked = document.querySelector('input[name="target"]:checked');
    return [checked ? checked.value : '', el.custom.value.trim(), el.allowResize.checked].join('|');
  }

  function onCompress() {
    if (busy || !src) return;
    clearError();
    var t = selectedTarget();
    if (t.error) { showError('<p>' + esc(t.error) + '</p>'); el.custom.focus(); return; }
    var id = ++jobSeq;
    var opts = optionsKey();
    clearResult();
    setBusy(true, true);
    setProgress(0);
    setStatus('Compressing to ' + t.kb + ' KB or less…');
    var file = srcFile, source = src, allowResize = el.allowResize.checked;

    compress(id, source, t.bytes, allowResize).then(function (out) {
      if (id !== jobSeq) return;
      if (optionsKey() !== opts) { stopForChangedOptions(); return; }   // never publish for old options
      if (out.ok) showResult(file, source, t, out); else showImpossible(file, source, t, out);
    }).catch(function (err) {
      if (err instanceof Cancelled || id !== jobSeq) return;
      showError('<p>' + esc(err && err.userMessage ? err.userMessage : 'Compression failed. Your phone may be low on memory. Close other tabs and try again, or use a smaller image.') + '</p>');
      setStatus('');
    }).then(function () {
      if (id !== jobSeq) return;
      setProgress(null);
      setBusy(false);
    });
  }

  function compress(id, source, target, allowResize) {
    var canvas = document.createElement('canvas');
    var encodes = 0;
    var curW = 0, curH = 0;

    function check() { if (id !== jobSeq) throw new Cancelled(); }

    function render(w, h) {
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#ffffff';                 // transparent pixels become white
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source.draw, 0, 0, w, h);
      curW = w; curH = h;
    }

    function encode(q) {
      if (encodes >= MAX_ENCODES) return Promise.resolve(null);
      encodes++;
      setProgress(encodes);
      setStatus('Trying quality ' + Math.round(q * 100) + '% at ' + fmtDims(curW, curH) + ' (attempt ' + encodes + ')…');
      return toBlob(canvas, 'image/jpeg', q).then(function (blob) {
        check();
        if (!blob) { var e = new Error('encode'); e.userMessage = 'Your browser could not create the JPEG. It may be out of memory. Try a smaller image.'; throw e; }
        if (blob.type !== 'image/jpeg') { var e2 = new Error('type'); e2.userMessage = 'Your browser does not support saving JPEG images from a web page.'; throw e2; }
        return { blob: blob, q: q, w: curW, h: curH };
      });
    }

    // Highest quality in [lo, hi] that fits, given that `lo` is already known to fit.
    function refine(best, lo, hi, steps) {
      if (steps <= 0 || hi - lo < 0.005 || encodes >= MAX_ENCODES) return Promise.resolve(best);
      var mid = (lo + hi) / 2;
      return encode(mid).then(function (r) {
        if (!r) return best;
        if (r.blob.size <= target) return refine(r, mid, hi, steps - 1);
        return refine(best, lo, mid, steps - 1);
      });
    }

    var smallest = null;
    function note(r) { if (r && (!smallest || r.blob.size < smallest.blob.size)) smallest = r; return r; }

    // Step 1: quality only, original dimensions.
    function qualityOnly() {
      render(source.width, source.height);
      return encode(Q_MAX).then(function (top) {
        note(top);
        if (top.blob.size <= target) return { ok: true, best: top };
        return encode(Q_MIN).then(function (low) {
          note(low);
          if (low.blob.size > target) return { ok: false };
          return refine(low, Q_MIN, Q_MAX, QUALITY_STEPS).then(function (best) { return { ok: true, best: best }; });
        });
      });
    }

    // Step 2 (only if allowed): shrink dimensions, keeping the aspect ratio.
    // The shortest side may not go below MIN_SIDE, so the smallest allowed scale is sMin.
    var shortSide = Math.min(source.width, source.height);
    var sMin = MIN_SIDE / shortSide;
    var BUDGET = { ok: false, reason: 'budget' };

    function dimsAt(s) {
      if (s <= sMin) s = sMin;
      var w = Math.round(source.width * s), h = Math.round(source.height * s);
      if (w <= h && w < MIN_SIDE) { w = MIN_SIDE; h = Math.round(MIN_SIDE * source.height / source.width); }
      if (h < w && h < MIN_SIDE) { h = MIN_SIDE; w = Math.round(MIN_SIDE * source.width / source.height); }
      return [w, h];
    }

    // Grow back toward the last scale that was too big, keeping the largest that fits.
    function growBack(fit, sFit, sFail, steps) {
      if (steps <= 0 || sFail / sFit < 1.04 || encodes >= MAX_ENCODES) return Promise.resolve({ fit: fit, s: sFit });
      var mid = Math.sqrt(sFit * sFail);
      var d = dimsAt(mid);
      render(d[0], d[1]);
      return encode(Q_RESIZE).then(function (r) {
        if (!r) return { fit: fit, s: sFit };
        note(r);
        if (r.blob.size <= target) return growBack(r, mid, sFail, steps - 1);
        return growBack(fit, sFit, mid, steps - 1);
      });
    }

    // A scale that fits at Q_RESIZE was found: enlarge as far as possible, then raise quality.
    function finishFit(r, sFit, sFail) {
      return growBack(r, sFit, sFail, 3).then(function (g) {
        if (curW !== g.fit.w || curH !== g.fit.h) render(g.fit.w, g.fit.h);   // canvas must match the kept size
        return refine(g.fit, Q_RESIZE, Q_MAX, 3);
      }).then(function (best) { return { ok: true, best: best }; });
    }

    // The estimate went below the smallest allowed size, or the rounds ran out:
    // measure the boundary itself instead of assuming it cannot work.
    function atMinimum(sFail) {
      var d = dimsAt(sMin);
      render(d[0], d[1]);
      return encode(Q_RESIZE).then(function (r) {
        if (!r) return BUDGET;
        note(r);
        if (r.blob.size <= target) return finishFit(r, sMin, sFail);
        return encode(Q_MIN).then(function (low) {
          if (!low) return BUDGET;
          note(low);
          if (low.blob.size > target) return { ok: false, reason: 'minSize', minW: d[0], minH: d[1], minBytes: low.blob.size };
          // Fits only below Q_RESIZE at the smallest size: find the highest quality that fits there.
          return refine(low, Q_MIN, Q_RESIZE, QUALITY_STEPS).then(function (best) { return { ok: true, best: best }; });
        });
      });
    }

    function shrink(round, sFail, lastSize) {
      if (encodes >= MAX_ENCODES) return Promise.resolve(BUDGET);
      if (round >= MAX_RESIZE_ROUNDS) return atMinimum(sFail);
      var next = sFail * Math.sqrt(target / lastSize) * 0.9;
      if (next >= sFail) next = sFail * 0.85;
      if (next <= sMin) return atMinimum(sFail);
      var d = dimsAt(next);
      render(d[0], d[1]);
      return encode(Q_RESIZE).then(function (r) {
        if (!r) return BUDGET;
        note(r);
        if (r.blob.size <= target) return finishFit(r, next, sFail);
        return shrink(round + 1, next, r.blob.size);
      });
    }

    return qualityOnly().then(function (res) {
      if (res.ok) return res;
      if (!allowResize) return { ok: false, reason: 'quality' };
      // Already at or below the smallest allowed size: the lowest-quality attempt was the last option.
      if (sMin >= 1) return { ok: false, reason: 'minSize', atOriginal: true, minW: source.width, minH: source.height, minBytes: smallest.blob.size };
      // Measure at the resize quality on full size to estimate the scale.
      render(source.width, source.height);
      return encode(Q_RESIZE).then(function (r) {
        if (!r) return BUDGET;
        note(r);
        return shrink(0, 1, r.blob.size);
      });
    }).then(function (res) {
      res.encodes = encodes;
      res.smallest = smallest;
      // Final safety check: never report success for a file over the limit.
      if (res.ok && (res.best.blob.size > target || res.best.blob.type !== 'image/jpeg')) res.ok = false;
      return res;
    }).finally(function () {
      canvas.width = canvas.height = 0;     // free canvas memory
    });
  }

  function outputName(name, kb) {
    var base = name.replace(/\.[^.]+$/, '').replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'photo';
    return base + '-under-' + kb + 'kb.jpg';
  }

  function setMeter(origBytes, outBytes, target, over) {
    var scale = Math.max(origBytes, outBytes, target) * 1.05;
    var pct = function (n) { return Math.max(0.5, (n / scale) * 100).toFixed(2) + '%'; };
    el.meterOrig.style.width = pct(origBytes);
    el.meterRes.style.width = pct(outBytes);
    el.meterRes.className = 'meter-fill ' + (over ? 'is-over' : 'is-ok');
    el.meterLimitA.style.left = el.meterLimitB.style.left = 'calc(' + ((target / scale) * 100).toFixed(2) + '% - 1px)';
  }

  function showResult(file, source, t, out) {
    var b = out.best;
    resultUrl = URL.createObjectURL(b.blob);
    el.resultHeading.textContent = 'Done: ' + fmtKB(b.blob.size) + ', under your ' + t.kb + ' KB limit';
    el.resSize.textContent = fmtSize(b.blob.size);
    el.resTarget.textContent = t.kb + ' KB (' + fmtBytes(t.bytes) + ')';
    var resized = b.w !== source.width || b.h !== source.height;
    el.resDims.textContent = fmtDims(b.w, b.h) + (resized ? ' (reduced from ' + fmtDims(source.width, source.height) + ')' : ' (unchanged)');
    el.resQuality.textContent = Math.round(b.q * 100) + '%';
    var notes = [];
    if (resized) notes.push('Quality changes alone could not reach the limit, so the dimensions were reduced. The shape (aspect ratio) is the same.');
    if (b.q < 0.4) notes.push('The JPEG quality is low, so expect blocky or blurry areas. Zoom in and check faces and text before you upload. If the form allows it, a larger limit will look better.');
    else if (b.q < 0.7) notes.push('Some fine detail is lost at this quality. Zoom in to check that faces and text are still clear.');
    if (srcInfo && srcInfo.type === 'jpeg' && file.size <= t.bytes && b.blob.size > file.size) notes.push('Your original was already smaller than this result. You can upload the original instead.');
    notes.push('The file is not padded to an exact size. It is simply at or below the limit you chose.');
    el.resNote.textContent = notes.join(' ');
    el.resPreview.src = resultUrl;
    el.resPreview.alt = 'Compressed version of ' + file.name;
    el.download.href = resultUrl;
    el.download.download = outputName(file.name, t.kb);
    el.download.hidden = false;
    setMeter(file.size, b.blob.size, t.bytes, false);
    el.result.hidden = false;
    setStatus('Done in ' + out.encodes + ' attempts. The new file is ' + fmtSize(b.blob.size) + '.');
    el.resultHeading.focus();
  }

  function showImpossible(file, source, t, out) {
    var s = out.smallest;
    var msg = '<p><strong>Could not get this image under ' + t.kb + ' KB (' + fmtBytes(t.bytes) + ').</strong> No file was created.</p>';
    if (out.reason === 'quality') {
      if (s) msg += '<p>The smallest result was ' + fmtSize(s.blob.size) + ' at ' + Math.round(s.q * 100) + '% quality and the original ' + fmtDims(s.w, s.h) + '.</p>';
      msg += '<p>Lowering the quality alone was not enough. Turn on <em>Allow smaller dimensions</em> and try again, or choose a larger limit.</p>';
    } else if (out.reason === 'minSize') {
      msg += out.atOriginal
        ? '<p>This image is already at the smallest size this tool allows (shortest side ' + MIN_SIDE + ' px or less), and at ' + Math.round(Q_MIN * 100) +
          '% quality it was ' + fmtSize(out.minBytes) + '. Choose a larger limit.</p>'
        : '<p>Even at the smallest size this tool allows, ' + fmtDims(out.minW, out.minH) + ' (shortest side ' + MIN_SIDE + ' px), and ' + Math.round(Q_MIN * 100) +
          '% quality, the file was ' + fmtSize(out.minBytes) + '. Choose a larger limit.</p>';
    } else {
      if (s) msg += '<p>The smallest result found was ' + fmtSize(s.blob.size) + ' at ' + Math.round(s.q * 100) + '% quality and ' + fmtDims(s.w, s.h) + '.</p>';
      msg += '<p>The tool stopped after its limit of ' + MAX_ENCODES + ' attempts without finding a version under the limit. ' +
        'This does not prove it is impossible. Try a slightly larger limit, or crop the photo first so there is less to store.</p>';
    }
    showError(msg);
    setStatus('Stopped after ' + out.encodes + ' attempts without reaching the limit.');
  }

  // ---------- Reset and cancellation ----------
  // Cancels any running job and returns the tool to "no image" with all controls usable.
  function clearAll(statusText) {
    jobSeq++;
    clearResult();
    releaseSource();
    clearError();
    setProgress(null);
    el.file.value = '';
    setBusy(false);
    setStatus(statusText || '');
  }

  function stopForChangedOptions() {
    jobSeq++;
    clearResult();
    setProgress(null);
    setBusy(false);
    setStatus('Settings changed, so compression stopped. Press Compress to start again.');
  }

  function onOptionChange() {
    // Controls are locked while compressing; this also covers changes made by scripts or extensions.
    if (compressing) stopForChangedOptions();
    updateCustomUi();
    clearResult();
  }

  function onReset() {
    clearAll('Cleared. Choose a photo to start again.');
    var def = document.querySelector('input[name="target"][value="50"]');
    if (def) def.checked = true;
    el.custom.value = '';
    el.allowResize.checked = false;
    updateCustomUi();
    el.file.focus();
  }

  // ---------- Wire up ----------
  el.tool.hidden = false;
  el.file.addEventListener('change', onFileChosen);
  el.compress.addEventListener('click', onCompress);
  el.reset.addEventListener('click', onReset);
  Array.prototype.forEach.call(el.targets, function (r) {
    r.addEventListener('change', function () {
      onOptionChange();
      if (r.value === 'custom' && r.checked && !el.custom.disabled) el.custom.focus();
    });
  });
  el.custom.addEventListener('input', onOptionChange);
  el.allowResize.addEventListener('change', onOptionChange);
  // Leaving the page cancels work and frees memory. If the browser later restores the page
  // from its back/forward cache, it comes back as a clean, usable tool with no image loaded.
  window.addEventListener('pagehide', function () { clearAll(''); });
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) clearAll('Choose a photo to start again.');
    else if (!src && !busy) el.file.value = '';   // ignore a file name the browser restored by itself
    updateCustomUi();
  });
  setBusy(false);
})();
