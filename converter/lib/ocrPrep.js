/* ============================================================
   ocrPrep — image preprocessing for the price scanner.
   Pure functions over RGBA pixel arrays so the live Lens and the
   eval harness (tools/lens-eval.mjs) run IDENTICAL pipelines.

   Two passes:
   - greyContrast: greyscale + contrast stretch. Best for solid print.
   - dotMatrixFuse: greyscale + box blur + hard contrast. Dot-matrix
     tags (thermal/impact printers on clothing tags) print glyphs as
     clusters of separate dots — plain OCR sees confetti. Blurring
     fuses the dots into solid strokes; the hard contrast then
     re-binarises the strokes. Used as a second pass when the first
     finds no prices.
   ============================================================ */

/** Greyscale + contrast stretch, in place. */
export function greyContrast(data, width, height, contrast = 1.35) {
  for (let i = 0; i < data.length; i += 4) {
    let g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    g = (g - 128) * contrast + 128;
    g = g < 0 ? 0 : g > 255 ? 255 : g;
    data[i] = data[i + 1] = data[i + 2] = g;
  }
}

/**
 * Greyscale + separable box blur (fuses dot clusters into strokes) +
 * ADAPTIVE contrast stretch, in place. radius 5 fuses dot gaps up to ~10px.
 * Blurred dot text lands at an unpredictable grey (it depends on the dot
 * duty cycle and lighting), so no fixed pivot works; instead the blurred
 * image is stretched between its own 2nd and 98th percentiles — ink maps
 * toward black and paper toward white whatever the print density.
 */
export function dotMatrixFuse(data, width, height, radius = 5) {
  const n = width * height;
  const grey = new Float32Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    grey[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }
  const tmp = new Float32Array(n);
  const blur = new Float32Array(n);
  const win = radius * 2 + 1;
  // Horizontal box blur (sliding window).
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    for (let x = -radius; x <= radius; x++) sum += grey[row + Math.min(width - 1, Math.max(0, x))];
    for (let x = 0; x < width; x++) {
      tmp[row + x] = sum / win;
      const out = Math.max(0, x - radius);
      const inn = Math.min(width - 1, x + radius + 1);
      sum += grey[row + inn] - grey[row + out];
    }
  }
  // Vertical box blur.
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = -radius; y <= radius; y++) sum += tmp[Math.min(height - 1, Math.max(0, y)) * width + x];
    for (let y = 0; y < height; y++) {
      blur[y * width + x] = sum / win;
      const out = Math.max(0, y - radius);
      const inn = Math.min(height - 1, y + radius + 1);
      sum += tmp[inn * width + x] - tmp[out * width + x];
    }
  }
  // Adaptive stretch between the 2nd and 98th percentile.
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) hist[Math.max(0, Math.min(255, Math.round(blur[i])))]++;
  const loCount = n * 0.02, hiCount = n * 0.98;
  let acc = 0, lo = 0, hi = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc <= loCount) lo = v;
    if (acc <= hiCount) hi = v;
  }
  const range = Math.max(16, hi - lo);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const c = Math.min(255, Math.max(0, ((blur[i] - lo) / range) * 255));
    data[p] = data[p + 1] = data[p + 2] = c;
  }
}
