import { h } from '../dom';

type Detect = (source: CanvasImageSource) => Promise<string | null>;

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;

/**
 * QR decoding: the built-in BarcodeDetector where it exists (Chrome on
 * Android, …), otherwise jsQR, loaded only when needed (e.g. Safari on iOS).
 */
async function createDetector(): Promise<Detect> {
  const Ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor & { getSupportedFormats?(): Promise<string[]> } }).BarcodeDetector;
  if (Ctor) {
    try {
      const formats = (await Ctor.getSupportedFormats?.()) ?? ['qr_code'];
      if (formats.includes('qr_code')) {
        const detector = new Ctor({ formats: ['qr_code'] });
        return async (source) => (await detector.detect(source))[0]?.rawValue ?? null;
      }
    } catch {
      // fall through to jsQR
    }
  }
  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return async (source) => {
    const { width, height } = sizeOf(source);
    if (!ctx || !width || !height) return null;
    // Downscale large frames: jsQR is fast enough at ~800 px.
    const scale = Math.min(1, 800 / Math.max(width, height));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(img.data, img.width, img.height)?.data ?? null;
  };
}

function sizeOf(source: CanvasImageSource): { width: number; height: number } {
  if (source instanceof HTMLVideoElement) return { width: source.videoWidth, height: source.videoHeight };
  if (source instanceof HTMLImageElement) return { width: source.naturalWidth, height: source.naturalHeight };
  const s = source as { width: number; height: number };
  return { width: s.width, height: s.height };
}

export interface Scanner {
  el: HTMLElement;
  stop(): void;
}

/** Live camera scanner. Calls `onResult` once with the first QR text found. */
export function cameraScanner(onResult: (text: string) => void, onError: (message: string) => void): Scanner {
  const video = h('video', { class: 'scanner-video', playsinline: true, muted: true, autoplay: true });
  const el = h('div', { class: 'scanner' }, video, h('div', { class: 'scanner-frame', 'aria-hidden': 'true' }));
  let stream: MediaStream | undefined;
  let stopped = false;

  const stop = () => {
    stopped = true;
    stream?.getTracks().forEach((t) => t.stop());
  };

  void (async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera');
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (stopped) return stop();
      video.srcObject = stream;
      await video.play();
      const detect = await createDetector();
      const tick = async () => {
        if (stopped) return;
        try {
          const text = video.readyState >= 2 ? await detect(video) : null;
          if (text && !stopped) {
            stop();
            onResult(text);
            return;
          }
        } catch {
          // keep scanning
        }
        setTimeout(() => void tick(), 200);
      };
      void tick();
    } catch {
      stop();
      onError('Kameran kunde inte startas. Ge webbläsaren tillgång till kameran, eller ta ett foto av QR-koden och välj bilden.');
    }
  })();

  return { el, stop };
}

/** Reads a QR code from a photo or screenshot. */
export async function decodeImageFile(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const detect = await createDetector();
    return await detect(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}
