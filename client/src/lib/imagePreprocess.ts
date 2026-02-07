/**
 * Image preprocessing pipeline for improving OCR accuracy.
 * Uses HTML Canvas to apply filters before passing to Tesseract.js.
 *
 * Pipeline:
 *  1. Upscale small images (so Tesseract has more pixels to work with)
 *  2. Convert to grayscale
 *  3. Increase contrast
 *  4. Apply adaptive thresholding (binarize to black & white)
 *  5. Sharpen edges
 */

/** Load a base64 data URL into an HTMLImageElement */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Get canvas 2D context with an image drawn onto it */
function imageToCanvas(
  img: HTMLImageElement,
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);
  return { canvas, ctx };
}

/** Convert image data to grayscale using luminance formula */
function grayscale(imageData: ImageData): void {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    // ITU-R BT.709 luminance
    const gray = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    d[i] = gray;
    d[i + 1] = gray;
    d[i + 2] = gray;
  }
}

/**
 * Increase contrast by stretching the histogram.
 * Maps the darkest pixel to 0 and the brightest to 255.
 */
function autoContrast(imageData: ImageData): void {
  const d = imageData.data;
  let min = 255;
  let max = 0;

  // Find actual min/max brightness
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i]; // already grayscale so R=G=B
    if (v < min) min = v;
    if (v > max) max = v;
  }

  // Avoid division by zero for solid-color images
  const range = max - min || 1;

  for (let i = 0; i < d.length; i += 4) {
    const v = Math.round(((d[i] - min) / range) * 255);
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
}

/**
 * Apply additional contrast boost using a contrast factor.
 * Factor > 1 increases contrast, < 1 decreases it.
 */
function boostContrast(imageData: ImageData, factor: number): void {
  const d = imageData.data;
  const intercept = 128 * (1 - factor);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, d[i] * factor + intercept));
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
}

/**
 * Adaptive thresholding (binarization).
 * For each pixel, compares it to the average brightness in a local window.
 * If darker than the local average minus a constant, it becomes black; otherwise white.
 * This works much better than a global threshold for uneven lighting on cable labels.
 */
function adaptiveThreshold(
  imageData: ImageData,
  blockSize: number = 15,
  constant: number = 10,
): void {
  const { width, height, data } = imageData;
  const half = Math.floor(blockSize / 2);

  // Build integral image for fast local-average computation
  const integral = new Float64Array((width + 1) * (height + 1));
  const w1 = width + 1;

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += data[(y * width + x) * 4];
      integral[(y + 1) * w1 + (x + 1)] =
        rowSum + integral[y * w1 + (x + 1)];
    }
  }

  // For each pixel, compute local mean and threshold
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half);
      const y0 = Math.max(0, y - half);
      const x1 = Math.min(width - 1, x + half);
      const y1 = Math.min(height - 1, y + half);

      const count = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum =
        integral[(y1 + 1) * w1 + (x1 + 1)] -
        integral[y0 * w1 + (x1 + 1)] -
        integral[(y1 + 1) * w1 + x0] +
        integral[y0 * w1 + x0];
      const mean = sum / count;

      const idx = (y * width + x) * 4;
      const val = data[idx] < mean - constant ? 0 : 255;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
    }
  }
}

/**
 * Sharpen the image using a 3×3 unsharp-mask convolution kernel.
 * Enhances edges so Tesseract can more easily detect character boundaries.
 */
function sharpen(imageData: ImageData): void {
  const { width, height, data } = imageData;
  const copy = new Uint8ClampedArray(data);

  // Sharpening kernel
  const kernel = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0,
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          sum += copy[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
        }
      }
      const idx = (y * width + x) * 4;
      const val = Math.max(0, Math.min(255, sum));
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
    }
  }
}

/**
 * Invert image if the background is dark (white text on dark background).
 * Tesseract works best with dark text on light background.
 */
function invertIfDarkBackground(imageData: ImageData): void {
  const d = imageData.data;
  let total = 0;
  const pixelCount = d.length / 4;

  for (let i = 0; i < d.length; i += 4) {
    total += d[i];
  }

  const avgBrightness = total / pixelCount;

  // If average brightness is below 128, the background is likely dark → invert
  if (avgBrightness < 128) {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255 - d[i];
      d[i + 1] = 255 - d[i + 1];
      d[i + 2] = 255 - d[i + 2];
    }
  }
}

export interface PreprocessOptions {
  /** Minimum width in pixels. Images smaller than this are upscaled. Default 1500. */
  minWidth?: number;
  /** Contrast boost factor (1 = no change, 1.5 = moderate, 2 = strong). Default 1.5. */
  contrastFactor?: number;
  /** Adaptive threshold block size (must be odd). Default 15. */
  thresholdBlockSize?: number;
  /** Adaptive threshold constant. Default 10. */
  thresholdConstant?: number;
  /** Whether to apply sharpening. Default true. */
  sharpenEnabled?: boolean;
  /** Whether to apply adaptive thresholding. Default true. */
  thresholdEnabled?: boolean;
}

/**
 * Full preprocessing pipeline.
 * Takes a base64 image data URL and returns a preprocessed base64 data URL
 * optimized for OCR recognition.
 */
export async function preprocessImageForOCR(
  imageSrc: string,
  options: PreprocessOptions = {},
): Promise<string> {
  const {
    minWidth = 1500,
    contrastFactor = 1.5,
    thresholdBlockSize = 15,
    thresholdConstant = 10,
    sharpenEnabled = true,
    thresholdEnabled = true,
  } = options;

  const img = await loadImage(imageSrc);

  // 1. Upscale if image is too small
  let width = img.naturalWidth;
  let height = img.naturalHeight;

  if (width < minWidth) {
    const scale = minWidth / width;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const { canvas, ctx } = imageToCanvas(img, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);

  // 2. Convert to grayscale
  grayscale(imageData);

  // 3. Auto-invert if dark background
  invertIfDarkBackground(imageData);

  // 4. Stretch histogram (auto-contrast)
  autoContrast(imageData);

  // 5. Boost contrast further
  if (contrastFactor !== 1) {
    boostContrast(imageData, contrastFactor);
  }

  // 6. Sharpen
  if (sharpenEnabled) {
    sharpen(imageData);
  }

  // 7. Adaptive threshold (binarize)
  if (thresholdEnabled) {
    adaptiveThreshold(imageData, thresholdBlockSize, thresholdConstant);
  }

  // Write processed data back and export
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}
