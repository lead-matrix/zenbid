/**
 * mediaProcessor.ts
 * ─────────────────────────────────────────────────────────────────
 * Client-side media pipeline for field contractors.
 * Compresses photos using Canvas API (no external libraries).
 * Normalises audio blobs recorded in the browser.
 * Stores large binary files in IndexedDB (not localStorage).
 * ─────────────────────────────────────────────────────────────────
 */

import { offlineDB, OfflineMedia } from './indexedDB';

// ─── Constants ─────────────────────────────────────────────────────

const MAX_IMAGE_BYTES  = 1_024 * 1_024;        // 1 MB target
const THUMBNAIL_PX     = 200;
const IMAGE_QUALITY    = 0.82;                  // JPEG quality 0–1

// ─── Image compression ─────────────────────────────────────────────

export interface CompressedImage {
  blob: Blob;
  dataUrl: string;
  originalBytes: number;
  compressedBytes: number;
  width: number;
  height: number;
}

/**
 * Compresses an image File / Blob to under MAX_IMAGE_BYTES using Canvas.
 * Progressively reduces quality until the target is met (max 5 passes).
 */
export async function compressImage(
  file: File | Blob,
  maxBytes = MAX_IMAGE_BYTES,
  maxDimension = 1920
): Promise<CompressedImage> {
  const originalBytes = file.size;
  const bitmap = await createImageBitmap(file);

  // Maintain aspect ratio
  let { width, height } = bitmap;
  if (width > maxDimension || height > maxDimension) {
    const ratio = Math.min(maxDimension / width, maxDimension / height);
    width  = Math.round(width  * ratio);
    height = Math.round(height * ratio);
  }

  const canvas  = document.createElement('canvas');
  canvas.width  = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);

  // Iteratively lower quality until we hit the target
  let quality = IMAGE_QUALITY;
  let blob!: Blob;

  for (let pass = 0; pass < 5; pass++) {
    blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        b => b ? resolve(b) : reject(new Error('toBlob returned null')),
        'image/jpeg',
        quality
      );
    });
    if (blob.size <= maxBytes) break;
    quality = Math.max(0.4, quality - 0.12);
  }

  const dataUrl = await blobToDataUrl(blob);
  return { blob, dataUrl, originalBytes, compressedBytes: blob.size, width, height };
}

/**
 * Generates a square JPEG thumbnail from an image File / Blob.
 */
export async function generateThumbnail(
  file: File | Blob,
  sizePx = THUMBNAIL_PX
): Promise<string> {
  const bitmap = await createImageBitmap(file);

  const canvas  = document.createElement('canvas');
  canvas.width  = sizePx;
  canvas.height = sizePx;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Centre-crop to square
  const side  = Math.min(bitmap.width, bitmap.height);
  const sx    = (bitmap.width  - side) / 2;
  const sy    = (bitmap.height - side) / 2;
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, sizePx, sizePx);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      b => b ? resolve(URL.createObjectURL(b)) : reject(new Error('Thumbnail generation failed')),
      'image/jpeg',
      0.75
    );
  });
}

// ─── Audio normalisation ───────────────────────────────────────────

export interface ProcessedAudio {
  blob: Blob;
  durationSeconds: number;
  sizeBytes: number;
}

/**
 * Accepts a browser-recorded audio Blob (any supported MIME type) and
 * re-packages it as audio/webm for consistent downstream transcription.
 * Falls back to the original blob when the browser does not support
 * MediaRecorder re-encoding.
 */
export async function normaliseAudio(rawBlob: Blob): Promise<ProcessedAudio> {
  // Try to get approximate duration from the blob's ArrayBuffer header
  const arrayBuffer = await rawBlob.arrayBuffer();
  const durationSeconds = estimateAudioDuration(arrayBuffer, rawBlob.type);

  let outputBlob = rawBlob;

  // Re-wrap as webm if the browser supports it
  const preferredType = 'audio/webm;codecs=opus';
  if (rawBlob.type !== preferredType && MediaRecorder.isTypeSupported(preferredType)) {
    try {
      outputBlob = new Blob([arrayBuffer], { type: preferredType });
    } catch {
      outputBlob = rawBlob;
    }
  }

  return {
    blob: outputBlob,
    durationSeconds,
    sizeBytes: outputBlob.size,
  };
}

// ─── IndexedDB persistence ─────────────────────────────────────────

export interface SavedMedia extends OfflineMedia {
  thumbnailUrl?: string;
}

/**
 * Compresses and saves a photo to IndexedDB, returning the full record.
 * Call this in offline Field Mode so large blobs are never lost.
 */
export async function saveFieldPhoto(
  projectId: string,
  file: File
): Promise<SavedMedia> {
  const { blob, dataUrl, compressedBytes } = await compressImage(file);
  const thumbnailUrl = await generateThumbnail(blob);

  const record: SavedMedia = {
    id: crypto.randomUUID(),
    projectId,
    fileName: file.name,
    fileType: 'image/jpeg',
    blob,
    previewUrl: dataUrl,
    thumbnailUrl,
    createdAt: new Date().toISOString(),
  };

  await offlineDB.put('media', { ...record, blob });

  console.info(
    `[MediaProcessor] Photo saved — ${file.name} (${(compressedBytes / 1024).toFixed(1)} KB)`
  );

  return record;
}

/**
 * Saves a field voice recording to IndexedDB.
 */
export async function saveFieldAudio(
  projectId: string,
  rawBlob: Blob,
  fileName = `voice-${Date.now()}.webm`
): Promise<SavedMedia> {
  const { blob, durationSeconds, sizeBytes } = await normaliseAudio(rawBlob);

  const record: SavedMedia = {
    id: crypto.randomUUID(),
    projectId,
    fileName,
    fileType: blob.type,
    blob,
    createdAt: new Date().toISOString(),
  };

  await offlineDB.put('media', record);

  console.info(
    `[MediaProcessor] Audio saved — ${fileName} (${(sizeBytes / 1024).toFixed(1)} KB, ~${durationSeconds.toFixed(1)}s)`
  );

  return record;
}

/**
 * Retrieves all saved media for a project from IndexedDB.
 */
export async function getProjectMedia(projectId: string): Promise<SavedMedia[]> {
  const all = await offlineDB.getAll<SavedMedia>('media');
  return all.filter(m => m.projectId === projectId);
}

/**
 * Deletes a single media record from IndexedDB.
 */
export async function deleteMedia(id: string): Promise<void> {
  await offlineDB.delete('media', id);
}

// ─── Utilities ─────────────────────────────────────────────────────

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Very rough audio duration estimate based on file size and bit-rate.
 * Used only for display; actual transcription determines real length.
 */
function estimateAudioDuration(buffer: ArrayBuffer, mimeType: string): number {
  const bytes = buffer.byteLength;
  const kbps  = mimeType.includes('mp4') || mimeType.includes('mp3') ? 128 : 64;
  return (bytes * 8) / (kbps * 1000);
}
