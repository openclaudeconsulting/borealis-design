/* ============================================================
   lens.js — the "point & price" engine.
   Rear camera -> crop the reticle band -> preprocess -> on-device
   OCR (Tesseract, offline) -> parse a price -> convert to your
   home currency. Browser-only.

   Reliability notes (learned from real devices):
   - A single hung OCR pass must never freeze the loop: every
     recognize() races an 8s watchdog; on timeout the worker is
     torn down and rebuilt automatically.
   - Reopening the scanner reuses the worker but must still report
     "ready", or the status pill lies forever.
   - iOS pauses/kills camera tracks on app-switch; we listen for
     track end and reacquire, and expose reset() as a user-facing
     full restart.
   ============================================================ */

import { selectPrices } from './lib/parsePrice.js';
import { convert, formatMoney } from './lib/convert.js';
import { greyContrast, dotMatrixFuse, rotatePointFromBase, rotateBoxToBase } from './lib/ocrPrep.js';

const VENDOR = new URL('vendor/tesseract/', document.baseURI).href;
const OCR_TIMEOUT_MS = 8000;   // a hung recognize() is recycled after this
const STALE_AFTER_MS = 6000;   // result older than this is flagged stale

// Minimal WASM-SIMD feature test so we load the right (single) core.
function simdSupported() {
  try {
    return WebAssembly.validate(new Uint8Array([
      0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11,
    ]));
  } catch { return false; }
}

let tesseractLoading = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (tesseractLoading) return tesseractLoading;
  tesseractLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = VENDOR + 'tesseract.min.js';
    s.onload = () => resolve(window.Tesseract);
    s.onerror = () => reject(new Error('Failed to load OCR engine'));
    document.head.appendChild(s);
  });
  return tesseractLoading;
}

export function isSecureCameraContext() {
  return window.isSecureContext && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

export function createLens(opts) {
  const {
    video, ocrCanvas, onResult, onStatus = () => {}, onError = () => {}, onStale = () => {},
    getShopCurrency, getHomeCurrency, getRates,
    intervalMs = 750,
  } = opts;

  let stream = null, worker = null, running = false, busy = false, timer = null;
  let track = null, torchOn = false;
  let lastGoodAt = 0, staleNotified = false;
  let pendingSig = null, pendingVotes = 0;
  let lastCrop = null;                    // {bandX, bandY, scale} of the last grab
  let target = null;                      // {x, y, at} in VIDEO coords (tap-to-focus)
  const TARGET_TTL_MS = 6000;
  // Fallback ladder for frames the standard pass can't read: dot-matrix
  // print and/or sideways tags. One ladder step per empty frame keeps every
  // tick at ≤2 OCR passes; a hit becomes the sticky preferred fallback so
  // subsequent frames of the same tag go straight to the winning recipe.
  const FALLBACKS = [
    { mode: 'fuse', rot: 0 },
    { mode: 'grey', rot: 90 }, { mode: 'fuse', rot: 90 },
    { mode: 'grey', rot: 270 }, { mode: 'fuse', rot: 270 },
  ];
  let fallbackIdx = 0;
  let preferredFallback = null;

  function emitReady() { onStatus({ phase: 'ready', text: 'Point at a price' }); }

  async function ensureWorker() {
    if (worker) { emitReady(); return worker; }
    onStatus({ phase: 'loading', progress: 0, text: 'Loading scanner…' });
    const Tesseract = await loadTesseract();
    const core = VENDOR + (simdSupported() ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js');
    const w = await Tesseract.createWorker('eng', 1, {
      workerPath: VENDOR + 'worker.min.js',
      corePath: core,
      langPath: VENDOR + 'lang',
      gzip: true,
      logger: (m) => {
        if (m.status && /load|initial/i.test(m.status)) {
          onStatus({ phase: 'loading', progress: m.progress || 0, text: 'Loading scanner…' });
        }
      },
    });
    // Character set and layout mode are shared with tools/lens-eval.mjs —
    // keep them in sync. Letters and % stay VISIBLE to OCR so the parser can
    // recognise non-prices ("40% RECYCLED POLYESTER", "500g", "6 pk") instead
    // of mistaking their digits for money. PSM 11 (sparse text) is essential:
    // block/column modes (6 and even 4) silently DROP a huge price line when
    // it doesn't fit the layout they assume — sparse finds every text chunk
    // with its bbox, and we restore top-to-bottom order ourselves.
    await w.setParameters({
      tessedit_char_whitelist: "0123456789.,'€£$¥₩₹฿%ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÉÈéè /()-",
      tessedit_pageseg_mode: '11',
    });
    worker = w;
    emitReady();
    return worker;
  }

  // Kill a wedged worker and build a fresh one; the scan loop keeps going.
  async function recoverWorker() {
    onStatus({ phase: 'loading', text: 'Restarting scanner…' });
    const dead = worker; worker = null;
    if (dead) {
      try { await Promise.race([dead.terminate(), new Promise((r) => setTimeout(r, 2000))]); } catch {}
    }
    try { await ensureWorker(); }
    catch { onError({ code: 'ocr', message: 'The scanner crashed. Tap Reset to try again.' }); }
  }

  async function acquireCamera() {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    video.srcObject = stream;
    video.setAttribute('playsinline', '');
    await video.play().catch(() => {});
    track = stream.getVideoTracks()[0];
    // iOS ends tracks on app-switch/lock; reacquire when that happens.
    track.addEventListener('ended', () => { if (running) restartCamera(); });
  }

  async function restartCamera() {
    try { if (stream) stream.getTracks().forEach((t) => t.stop()); } catch {}
    try { await acquireCamera(); }
    catch { onError({ code: 'camera', message: 'The camera stopped. Tap Reset to restart it.' }); }
  }

  async function start() {
    if (!isSecureCameraContext()) {
      onError({ code: 'insecure', message: 'Camera needs a secure (https) connection.' });
      return false;
    }
    try {
      onStatus({ phase: 'camera', text: 'Starting camera…' });
      await acquireCamera();
    } catch (err) {
      const map = {
        NotAllowedError: 'Camera permission was denied. Enable it in your browser settings to scan.',
        NotFoundError: 'No camera found on this device.',
        NotReadableError: 'The camera is in use by another app.',
        SecurityError: 'Camera blocked by the browser’s security settings.',
      };
      onError({ code: err.name || 'error', message: map[err.name] || ('Camera error: ' + err.message) });
      return false;
    }
    running = true;
    // Load OCR in parallel; scanning begins once it's ready. On reopen the
    // worker already exists and ensureWorker reports ready immediately.
    ensureWorker().then(() => { scheduleTick(0); }).catch((e) => {
      onError({ code: 'ocr', message: e.message || 'Could not start the scanner.' });
    });
    return true;
  }

  function torchCapable() {
    if (!track || !track.getCapabilities) return false;
    try { return 'torch' in track.getCapabilities(); } catch { return false; }
  }

  async function toggleTorch() {
    if (!torchCapable()) return false;
    torchOn = !torchOn;
    try { await track.applyConstraints({ advanced: [{ torch: torchOn }] }); }
    catch { torchOn = false; return false; }
    return torchOn;
  }

  function scheduleTick(delay = intervalMs) {
    if (!running) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(tick, delay);
  }

  // Grab the reticle band and keep the RAW pixels; tick() renders one or
  // more processed variants of the same frame (contrast / dot-fused, plus
  // rotations for sideways tags). Keep the band fractions in sync with the
  // .reticle CSS so the on-screen box matches exactly what is scanned.
  let rawFrame = null; // ImageData of the unprocessed crop
  const rotCanvas = document.createElement('canvas');
  function grabReticle() {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return false;
    const bandX = vw * 0.08, bandW = vw * 0.84;
    const bandY = vh * 0.32, bandH = vh * 0.36;
    const scale = 1.5;
    ocrCanvas.width = Math.round(bandW * scale);
    ocrCanvas.height = Math.round(bandH * scale);
    const ctx = ocrCanvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, bandX, bandY, bandW, bandH, 0, 0, ocrCanvas.width, ocrCanvas.height);
    rawFrame = ctx.getImageData(0, 0, ocrCanvas.width, ocrCanvas.height);
    lastCrop = { bandX, bandY, scale };
    return true;
  }

  // Render the raw frame with a given prep mode and rotation.
  // rot 90 reads tags turned 90° CCW in the world; rot 270 the other way.
  function buildPassCanvas(mode, rot) {
    if (!rawFrame) return null;
    const W = rawFrame.width, H = rawFrame.height;
    const img = new ImageData(new Uint8ClampedArray(rawFrame.data), W, H);
    if (mode === 'fuse') dotMatrixFuse(img.data, W, H); else greyContrast(img.data, W, H);
    ocrCanvas.width = W; ocrCanvas.height = H;
    ocrCanvas.getContext('2d', { willReadFrequently: true }).putImageData(img, 0, 0);
    if (rot !== 90 && rot !== 270) return ocrCanvas;
    rotCanvas.width = H; rotCanvas.height = W;
    const rctx = rotCanvas.getContext('2d');
    rctx.save();
    if (rot === 90) { rctx.translate(H, 0); rctx.rotate(Math.PI / 2); }
    else { rctx.translate(0, W); rctx.rotate(-Math.PI / 2); }
    rctx.drawImage(ocrCanvas, 0, 0);
    rctx.restore();
    return rotCanvas;
  }

  async function tick() {
    if (!running) return;
    if (busy || !worker) { scheduleTick(); return; }
    if (!grabReticle()) { scheduleTick(); return; }
    busy = true;
    try {
      const shop = getShopCurrency();
      const home = getHomeCurrency();
      const rates = getRates();
      // Active tap-target? Convert it from video coords into this crop's
      // coordinate space so nearest-line matching works.
      let cropTarget = null;
      if (target && Date.now() - target.at < TARGET_TTL_MS && lastCrop) {
        cropTarget = {
          x: (target.x - lastCrop.bandX) * lastCrop.scale,
          y: (target.y - lastCrop.bandY) * lastCrop.scale,
        };
      } else if (target) {
        target = null; // expired
      }
      const crop = lastCrop;

      // OCR one canvas → converted price items. Shared by all passes.
      // `rot` maps result boxes (and the tap target) between the rotated
      // pass image and the base crop.
      const runPass = async (mode, rot) => {
        const cv = buildPassCanvas(mode, rot);
        if (!cv) return { items: [], confidence: 0 };
        const passTarget = cropTarget
          ? rotatePointFromBase(cropTarget.x, cropTarget.y, rot, rawFrame.width, rawFrame.height)
          : null;
        // Watchdog: a wedged recognize() must not freeze the loop forever.
        const rec = await Promise.race([
          worker.recognize(cv),
          new Promise((_, rej) => setTimeout(() => rej(new Error('ocr-timeout')), OCR_TIMEOUT_MS)),
        ]);
        const { data } = rec;
        // Feed OCR lines (with their pixel heights) to the shared selection
        // logic: strict per-line parsing, big-print priority, and per-unit
        // price demotion — identical to what tools/lens-eval.mjs scores.
        const lines = (data.lines && data.lines.length)
          ? data.lines
              .map((l) => ({
                text: l.text,
                confidence: l.confidence,
                height: l.bbox ? (l.bbox.y1 - l.bbox.y0) : 0,
                top: l.bbox ? l.bbox.y0 : 0,
                bbox: l.bbox || null,
              }))
              .sort((a, b) => a.top - b.top) // sparse mode: restore reading order
          : String(data.text || '').split('\n').map((t) => ({ text: t, confidence: data.confidence, height: 0 }));
        const items = selectPrices(lines, { shopCurrency: shop, target: passTarget }).map((sel) => {
          const from = sel.currency || shop;
          const converted = convert(sel.value, from, home, rates);
          if (!Number.isFinite(converted)) return null;
          // Map the matched line's bbox (possibly in rotated coords) back to
          // the base crop, then to VIDEO coordinates for the lock-on box.
          let box = null;
          if (sel.bbox && crop) {
            const b = rotateBoxToBase(sel.bbox, rot, rawFrame.width, rawFrame.height);
            box = {
              x0: crop.bandX + b.x0 / crop.scale,
              y0: crop.bandY + b.y0 / crop.scale,
              x1: crop.bandX + b.x1 / crop.scale,
              y1: crop.bandY + b.y1 / crop.scale,
            };
          }
          return {
            value: sel.value, from, home, converted,
            fromText: formatMoney(sel.value, from),
            homeText: formatMoney(converted, home),
            raw: sel.raw, box,
          };
        }).filter(Boolean);
        return { items, confidence: data.confidence };
      };

      // Pass A: standard contrast, upright. When it finds nothing, try ONE
      // fallback this frame: the sticky preferred recipe if we have one,
      // otherwise the next rung of the ladder (dot-fuse, then rotations for
      // sideways tags). Converges on any print/orientation combo within a
      // few frames while keeping every tick at ≤2 OCR passes.
      let { items, confidence } = await runPass('grey', 0);
      if (!items.length) {
        if (preferredFallback) {
          ({ items, confidence } = await runPass(preferredFallback.mode, preferredFallback.rot));
          if (!items.length) preferredFallback = null;
        } else {
          const fb = FALLBACKS[fallbackIdx];
          fallbackIdx = (fallbackIdx + 1) % FALLBACKS.length;
          ({ items, confidence } = await runPass(fb.mode, fb.rot));
          if (items.length) preferredFallback = fb;
        }
      }
      if (items.length) {
        // Two-frame voting: only surface a reading the OCR produced twice in
        // a row. Single-frame hallucinations (glare, motion blur, overlapping
        // tags) die here instead of flashing wrong numbers at the user.
        const sig = items.map((i) => i.from + ':' + i.value).join('|');
        if (sig === pendingSig) pendingVotes++; else { pendingSig = sig; pendingVotes = 1; }
        if (pendingVotes >= 2) {
          lastGoodAt = Date.now();
          staleNotified = false;
          onResult({
            items,
            multi: items.length > 1,
            ...items[0], // single-price consumers keep working unchanged
            confidence: Math.round(confidence),
          });
        }
      }
      // An empty frame leaves the pending vote intact — hand shake between
      // two good frames shouldn't restart the count.
    } catch (err) {
      if (err && err.message === 'ocr-timeout') await recoverWorker();
      /* other transient OCR errors — keep scanning */
    } finally {
      busy = false;
      // Flag a displayed result as stale once it stops matching what the
      // camera sees, so the UI can dim it instead of lying.
      if (lastGoodAt && !staleNotified && Date.now() - lastGoodAt > STALE_AFTER_MS) {
        staleNotified = true;
        onStale();
      }
      scheduleTick();
    }
  }

  async function stop() {
    running = false;
    if (timer) clearTimeout(timer);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null; track = null; torchOn = false;
    if (video) video.srcObject = null;
  }

  async function terminate() {
    await stop();
    if (worker) {
      // A wedged worker may never resolve terminate() — don't let it hold
      // Reset hostage; hard-abandon it after 2.5s.
      const dead = worker; worker = null;
      try { await Promise.race([dead.terminate(), new Promise((r) => setTimeout(r, 2500))]); } catch {}
    }
  }

  // Camera-style tap-to-focus: hone in on the number nearest this point
  // (VIDEO coordinates). Active for a few seconds, then size ranking resumes.
  function setTarget(vx, vy) {
    target = { x: vx, y: vy, at: Date.now() };
    // A new intent invalidates the current vote so the switch feels instant.
    pendingSig = null; pendingVotes = 0;
  }

  // User-facing full restart: fresh camera, fresh OCR worker, clean state.
  async function reset() {
    busy = false;
    await terminate();
    lastGoodAt = 0; staleNotified = false;
    pendingSig = null; pendingVotes = 0;
    target = null; lastCrop = null;
    fallbackIdx = 0; preferredFallback = null;
    return start();
  }

  return { start, stop, terminate, reset, setTarget, toggleTorch, torchCapable, isRunning: () => running };
}
