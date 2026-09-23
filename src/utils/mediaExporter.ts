import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export interface RecordedSignData {
  id: string;
  blob: Blob;
  url: string;
  words: string;
  duration: number;
  timestamp: number;
}

export interface GifExportOptions {
  fps?: number; // default 12-14
  scale?: number; // resize scale factor (e.g. 0.75 for fast encoding, max width ~400px)
  startTime: number;
  endTime: number;
  onProgress?: (percent: number) => void;
}

/**
 * Detect best supported video MIME type for MediaRecorder on current browser
 */
export function getSupportedVideoMimeType(): string {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return 'video/webm';
  }
  const mimeTypes = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4;codecs=avc1',
    'video/mp4',
  ];
  for (const mime of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return 'video/webm';
}

/**
 * Converts a segment of a video Blob to an animated GIF using client-side gifenc
 */
export async function convertVideoToGif(
  videoBlob: Blob,
  options: GifExportOptions
): Promise<{ blob: Blob; url: string }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    const videoUrl = URL.createObjectURL(videoBlob);
    video.src = videoUrl;

    const cleanup = () => {
      URL.revokeObjectURL(videoUrl);
      video.remove();
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Failed to load video for GIF conversion.'));
    };

    video.onloadedmetadata = async () => {
      try {
        const duration = video.duration || 3;
        const startTime = Math.max(0, Math.min(options.startTime, duration - 0.2));
        const endTime = Math.min(duration, Math.max(options.endTime, startTime + 0.2));
        const trimDuration = endTime - startTime;

        const fps = options.fps || 12;
        const frameInterval = 1 / fps;
        const totalFrames = Math.max(1, Math.round(trimDuration * fps));

        // Determine output dimensions (default max ~380px for fast mobile encoding & small file size)
        const originalWidth = video.videoWidth || 640;
        const originalHeight = video.videoHeight || 640;
        const maxDimension = 380;
        let width = originalWidth;
        let height = originalHeight;

        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        // Ensure even dimensions
        width = Math.floor(width / 2) * 2;
        height = Math.floor(height / 2) * 2;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          cleanup();
          throw new Error('Could not get 2D canvas context');
        }

        const encoder = GIFEncoder();
        const frameDelay = Math.round(1000 / fps);

        for (let i = 0; i < totalFrames; i++) {
          const targetTime = startTime + i * frameInterval;
          await seekVideo(video, targetTime);

          ctx.drawImage(video, 0, 0, width, height);
          const imageData = ctx.getImageData(0, 0, width, height);

          // Quantize colors to a 256-color palette
          const palette = quantize(imageData.data, 256, {
            format: 'rgba4444',
            oneBitAlpha: true,
          });

          // Map pixels to palette index
          const index = applyPalette(imageData.data, palette);

          // Write GIF frame
          encoder.writeFrame(index, width, height, {
            palette,
            delay: frameDelay,
          });

          if (options.onProgress) {
            options.onProgress(Math.round(((i + 1) / totalFrames) * 100));
          }
        }

        encoder.finish();
        const gifBytes = encoder.bytes();
        const gifBlob = new Blob([gifBytes], { type: 'image/gif' });
        const gifUrl = URL.createObjectURL(gifBlob);

        cleanup();
        resolve({ blob: gifBlob, url: gifUrl });
      } catch (err) {
        cleanup();
        reject(err);
      }
    };
  });
}

/**
 * Trims a video Blob to the specified start/end range
 */
export async function trimVideo(
  videoBlob: Blob,
  startTime: number,
  endTime: number,
  fullDuration: number
): Promise<{ blob: Blob; url: string }> {
  // If untrimmed, return original
  if (startTime <= 0.05 && Math.abs(endTime - fullDuration) <= 0.1) {
    return { blob: videoBlob, url: URL.createObjectURL(videoBlob) };
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    const videoUrl = URL.createObjectURL(videoBlob);
    video.src = videoUrl;

    const cleanup = () => {
      URL.revokeObjectURL(videoUrl);
      video.remove();
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Failed to load video for trimming.'));
    };

    video.onloadedmetadata = async () => {
      try {
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 640;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          throw new Error('Canvas 2D context unavailable');
        }

        const stream = canvas.captureStream(30);
        const mimeType = getSupportedVideoMimeType();
        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 2500000,
        });

        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        const duration = endTime - startTime;
        let animationFrameId: number;
        let isRecording = false;

        recorder.onstop = () => {
          cancelAnimationFrame(animationFrameId);
          cleanup();
          const trimmedBlob = new Blob(chunks, { type: mimeType });
          resolve({ blob: trimmedBlob, url: URL.createObjectURL(trimmedBlob) });
        };

        await seekVideo(video, startTime);

        const drawLoop = () => {
          if (!isRecording) return;
          ctx.drawImage(video, 0, 0, width, height);
          if (video.currentTime >= endTime || video.ended) {
            isRecording = false;
            video.pause();
            recorder.stop();
            return;
          }
          animationFrameId = requestAnimationFrame(drawLoop);
        };

        isRecording = true;
        recorder.start(100);
        video.play();
        drawLoop();

        // Safety timeout in case video stalls
        setTimeout(() => {
          if (isRecording) {
            isRecording = false;
            try {
              video.pause();
              recorder.stop();
            } catch {}
          }
        }, Math.max(3000, (duration + 1.5) * 1000));
      } catch (err) {
        cleanup();
        reject(err);
      }
    };
  });
}

/**
 * Helper to reliably seek a video to a specific time
 */
function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = Math.max(0, time);
  });
}

/**
 * Download a Blob directly to the user's filesystem
 */
export function downloadMediaBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 300);
}

/**
 * Share a media file using native device share sheet (WhatsApp, etc.)
 * Falls back to direct download if navigator.share with files is not supported.
 */
export async function shareOrDownloadMedia(
  blob: Blob,
  filename: string,
  title: string,
  text: string
): Promise<{ shared: boolean; downloaded: boolean }> {
  const file = new File([blob], filename, { type: blob.type });

  if (
    typeof navigator !== 'undefined' &&
    navigator.canShare &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title,
        text,
      });
      return { shared: true, downloaded: false };
    } catch (err: any) {
      // User cancelled share dialog
      if (err?.name === 'AbortError') {
        return { shared: false, downloaded: false };
      }
      // If error occurs during sharing, fall back to download
      downloadMediaBlob(blob, filename);
      return { shared: false, downloaded: true };
    }
  } else {
    // Native sharing with files not supported (e.g. desktop), download directly
    downloadMediaBlob(blob, filename);
    return { shared: false, downloaded: true };
  }
}
