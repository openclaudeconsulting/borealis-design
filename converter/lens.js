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

import { parsePrice } from './lib/parsePrice.js';
import { convert, formatMoney } from './lib/convert.js';

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
    // Bias OCR toward price glyphs; read the crop as a block of lines so a
    // menu with several prices yields one result per line, in order.
    await w.setParameters({
      tessedit_char_whitelist: '0123456789.,€£$¥₩₹฿ CHFkrRp',
      tessedit_pageseg_mode: '6', // uniform block of text
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

  // Grab the reticle band, upscale + greyscale + contrast-stretch for OCR.
  // Keep these fractions in sync with the .reticle CSS so the on-screen box
  // matches exactly what is scanned.
  function grabReticle() {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return null;
    const bandX = vw * 0.08, bandW = vw * 0.84;
    const bandY = vh * 0.32, bandH = vh * 0.36;
    const scale = 1.5;
    ocrCanvas.width = Math.round(bandW * scale);
    ocrCanvas.height = Math.round(bandH * scale);
    const ctx = ocrCanvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, bandX, bandY, bandW, bandH, 0, 0, ocrCanvas.width, ocrCanvas.height);
    const img = ctx.getImageData(0, 0, ocrCanvas.width, ocrCanvas.height);
    const d = img.data;
    // Greyscale + simple contrast curve.
    for (let i = 0; i < d.length; i += 4) {
      let g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      g = (g - 128) * 1.35 + 128;              // contrast
      g = g < 0 ? 0 : g > 255 ? 255 : g;
      d[i] = d[i + 1] = d[i + 2] = g;
    }
    ctx.putImageData(img, 0, 0);
    return ocrCanvas;
  }

  async function tick() {
    if (!running) return;
    if (busy || !worker) { scheduleTick(); return; }
    const canvas = grabReticle();
    if (!canvas) { scheduleTick(); return; }
    busy = true;
    try {
      // Watchdog: a wedged recognize() must not freeze the loop forever.
      const rec = await Promise.race([
        worker.recognize(canvas),
        new Promise((_, rej) => setTimeout(() => rej(new Error('ocr-timeout')), OCR_TIMEOUT_MS)),
      ]);
      const { data } = rec;
      const shop = getShopCurrency();
      const home = getHomeCurrency();
      const rates = getRates();
      // Parse every OCR line separately: a menu with several prices yields
      // one converted entry per line, preserved in top-to-bottom order.
      const lines = (data.lines && data.lines.length)
        ? data.lines
        : String(data.text || '').split('\n').map((t) => ({ text: t, confidence: data.confidence }));
      const items = [];
      for (const ln of lines) {
        if (!ln.text) continue;
        if (ln.confidence != null && ln.confidence < 30) continue;
        const parsed = parsePrice(ln.text, { shopCurrency: shop });
        if (!parsed || !(parsed.value > 0)) continue;
        const from = parsed.currency || shop;
        const converted = convert(parsed.value, from, home, rates);
        if (!Number.isFinite(converted)) continue;
        items.push({
          value: parsed.value, from, home, converted,
          fromText: formatMoney(parsed.value, from),
          homeText: formatMoney(converted, home),
          raw: parsed.raw,
        });
        if (items.length >= 6) break; // keep the overlay readable
      }
      if (items.length) {
        lastGoodAt = Date.now();
        staleNotified = false;
        onResult({
          items,
          multi: items.length > 1,
          ...items[0], // single-price consumers keep working unchanged
          confidence: Math.round(data.confidence),
        });
      }
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

  // User-facing full restart: fresh camera, fresh OCR worker, clean state.
  async function reset() {
    busy = false;
    await terminate();
    lastGoodAt = 0; staleNotified = false;
    return start();
  }

  return { start, stop, terminate, reset, toggleTorch, torchCapable, isRunning: () => running };
}
