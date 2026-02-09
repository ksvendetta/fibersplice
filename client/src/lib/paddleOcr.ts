/**
 * PaddleOCR wrapper using @gutenye/ocr-browser (PP-OCRv4 via ONNX Runtime Web).
 *
 * Provides a singleton OCR instance that lazily initializes on first use.
 * Falls back to Tesseract.js if PaddleOCR fails to load.
 */

import * as ort from "onnxruntime-web";

// Configure ONNX Runtime WASM before any model loading
// Single-threaded avoids the crossOriginIsolated requirement on GitHub Pages
ort.env.wasm.numThreads = 1;

// Resolve base path so WASM files are found on GitHub Pages (/FiberMapConnect/)
const base = import.meta.env.BASE_URL ?? "/";
ort.env.wasm.wasmPaths = base;

type OcrInstance = {
  detect: (
    image: string,
  ) => Promise<Array<{ text: string; mean: number; box?: number[][] }>>;
};

let ocrInstance: OcrInstance | null = null;
let initPromise: Promise<OcrInstance | null> | null = null;

/**
 * Lazily initialize the PaddleOCR engine.
 * Returns null if initialization fails (caller should fall back to Tesseract).
 */
export async function getPaddleOcr(): Promise<OcrInstance | null> {
  if (ocrInstance) return ocrInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const { default: Ocr } = await import("@gutenye/ocr-browser");
      const modelsBase = `${base}models`;
      const instance = await Ocr.create({
        models: {
          detectionPath: `${modelsBase}/ch_PP-OCRv4_det_infer.onnx`,
          recognitionPath: `${modelsBase}/ch_PP-OCRv4_rec_infer.onnx`,
          dictionaryPath: `${modelsBase}/ppocr_keys_v1.txt`,
        },
      });
      ocrInstance = instance;
      return instance;
    } catch (err) {
      console.warn("PaddleOCR init failed, will use Tesseract fallback:", err);
      return null;
    }
  })();

  return initPromise;
}

export interface PaddleOcrResult {
  /** All recognized lines joined with newlines */
  text: string;
  /** Individual line results with confidence */
  lines: Array<{ text: string; confidence: number }>;
}

/**
 * Run PaddleOCR on a base64 data URL image.
 * Returns null if PaddleOCR is unavailable (caller should fall back to Tesseract).
 */
export async function runPaddleOcr(
  imageDataUrl: string,
): Promise<PaddleOcrResult | null> {
  const ocr = await getPaddleOcr();
  if (!ocr) return null;

  const results = await ocr.detect(imageDataUrl);

  const lines = results.map((r) => ({
    text: r.text,
    confidence: r.mean,
  }));

  return {
    text: lines.map((l) => l.text).join("\n"),
    lines,
  };
}
