import type { VideoFrameRecorder, VideoRecording, VideoRecordingSpec } from '@opencanvas/export';

/**
 * Encoding rendered frames into a video file, in the browser, with no server and no upload.
 *
 * `MediaRecorder` records a media stream in real time, so the frames are rendered first and
 * then played back onto a canvas at the planned frame rate while the recorder runs. Pushing
 * frames as fast as they rasterize would be simpler, but the encoder timestamps them by wall
 * clock — a slow machine would produce a slow-motion file. Playing to a clock keeps the video
 * the length the dialog promised, whatever the machine does.
 */

/** Containers to try, best first. Browsers disagree, so support is probed rather than assumed. */
const MIME_CANDIDATES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4',
] as const;

/** Enough headroom for flat vector artwork at 1080p without producing a huge file. */
const BITS_PER_PIXEL_PER_SECOND = 0.12;

export function supportedVideoMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const mime of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch {
      // A browser that throws on probing cannot be trusted with the format either.
    }
  }
  return null;
}

/** Whether this browser can record at all. The download dialog asks before offering video. */
export function isVideoExportSupported(): boolean {
  if (typeof HTMLCanvasElement === 'undefined') return false;
  if (typeof HTMLCanvasElement.prototype.captureStream !== 'function') return false;
  return supportedVideoMimeType() !== null;
}

function extensionFor(mimeType: string): VideoRecording['extension'] {
  return mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, ms));
  });
}

function decodeFrame(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error('A rendered frame could not be decoded.'));
    };
    image.src = dataUrl;
  });
}

/**
 * Collects frames, then records them to a video file.
 *
 * Frames are kept as PNG data URLs rather than decoded bitmaps: a decoded 1080p frame costs
 * about 8 MB, which a few hundred of would exhaust the tab, while the compressed form of flat
 * artwork is a fraction of that. Each frame is decoded one step ahead of the playhead so the
 * decode happens inside the time the previous frame is on screen.
 */
export function createBrowserVideoRecorder(spec: VideoRecordingSpec): VideoFrameRecorder {
  const frames: string[] = [];
  let cancelled = false;

  return {
    addFrame(dataUrl) {
      if (cancelled) return;
      frames.push(dataUrl);
    },

    cancel() {
      cancelled = true;
      frames.length = 0;
    },

    async finish(): Promise<VideoRecording> {
      if (frames.length === 0) throw new Error('No frames were rendered for the video.');
      const mimeType = supportedVideoMimeType();
      if (mimeType === null) throw new Error('This browser cannot record video.');

      const canvas = document.createElement('canvas');
      canvas.width = spec.width;
      canvas.height = spec.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('This browser refused to create a 2D drawing context.');
      // A page with a transparent background would otherwise record as black.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, spec.width, spec.height);

      const stream = canvas.captureStream(spec.fps);
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: Math.round(
          spec.width * spec.height * spec.fps * BITS_PER_PIXEL_PER_SECOND,
        ),
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      const stopped = new Promise<void>((resolve, reject) => {
        recorder.onstop = () => {
          resolve();
        };
        recorder.onerror = () => {
          reject(new Error('The browser stopped recording before the video was finished.'));
        };
      });

      const frameMs = 1000 / spec.fps;
      try {
        recorder.start();
        const started = performance.now();
        const first = frames[0];
        if (first === undefined) throw new Error('No frames were rendered for the video.');
        let next = decodeFrame(first);
        for (let index = 0; index < frames.length; index += 1) {
          const image = await next;
          const following = frames[index + 1];
          // Start the next decode before sleeping, so it overlaps this frame's screen time.
          next = following === undefined ? Promise.resolve(image) : decodeFrame(following);
          await wait(started + index * frameMs - performance.now());
          if (cancelled) break;
          context.drawImage(image, 0, 0, spec.width, spec.height);
        }
        // Hold the final frame so the encoder captures it rather than cutting on the last draw.
        await wait(started + frames.length * frameMs - performance.now());
      } finally {
        if (recorder.state !== 'inactive') recorder.stop();
        for (const track of stream.getTracks()) track.stop();
      }

      await stopped;
      const blob = new Blob(chunks, { type: mimeType });
      if (blob.size === 0) throw new Error('The browser produced an empty video file.');
      return { blob, mimeType, extension: extensionFor(mimeType) };
    },
  };
}
