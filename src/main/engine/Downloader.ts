import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import { DownloadItem, DownloadSegment, ProbeResult, FileCategory } from '../../shared/types';

export class Downloader {
  private abortController: AbortController | null = null;
  private fileHandle: fs.promises.FileHandle | null = null;
  private activeStreams: Array<{ req: http.ClientRequest; res?: http.IncomingMessage }> = [];
  private lastSpeedCheckTime = Date.now();
  private lastDownloadedBytes = 0;
  private speedSamples: number[] = [];
  private progressInterval: NodeJS.Timeout | null = null;

  constructor(
    public item: DownloadItem,
    private onProgress: (item: DownloadItem) => void,
    private onComplete: (item: DownloadItem) => void,
    private onError: (item: DownloadItem, error: Error) => void
  ) {}

  /**
   * Probe a URL using HEAD or ranged GET to discover file metadata
   */
  public static async probeUrl(targetUrl: string, customHeaders?: Record<string, string>): Promise<ProbeResult> {
    return new Promise((resolve, reject) => {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(targetUrl);
      } catch (err) {
        return reject(new Error('Invalid URL format'));
      }

      const client = parsedUrl.protocol === 'https:' ? https : http;
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 HyperFetch/1.0',
        'Accept': '*/*',
        ...(customHeaders || {}),
      };

      // First attempt: HEAD request
      const req = client.request(parsedUrl, { method: 'HEAD', headers }, (res) => {
        // If server redirects (301, 302, 307, 308), follow redirect
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, parsedUrl).toString();
          return Downloader.probeUrl(redirectUrl, customHeaders).then(resolve).catch(reject);
        }

        if (res.statusCode && res.statusCode >= 400 && res.statusCode !== 405) {
          // If HEAD gave 405 Method Not Allowed, fallback to ranged GET
          return Downloader.fallbackProbeWithRangedGet(parsedUrl, headers).then(resolve).catch(reject);
        }

        const acceptRanges = res.headers['accept-ranges'];
        const contentLength = res.headers['content-length'];
        const contentDisposition = res.headers['content-disposition'];
        const contentType = res.headers['content-type'] || 'application/octet-stream';
        const etag = res.headers['etag'];
        const lastModified = res.headers['last-modified'];

        const totalBytes = contentLength ? parseInt(contentLength, 10) : -1;
        const resumable = acceptRanges === 'bytes';
        const filename = Downloader.extractFilename(contentDisposition, parsedUrl.pathname);
        const category = Downloader.categorize(filename, contentType);

        resolve({
          url: targetUrl,
          filename,
          totalBytes: isNaN(totalBytes) ? -1 : totalBytes,
          resumable,
          contentType,
          category,
          etag: Array.isArray(etag) ? etag[0] : etag,
          lastModified: Array.isArray(lastModified) ? lastModified[0] : lastModified,
        });
      });

      req.on('error', () => {
        Downloader.fallbackProbeWithRangedGet(parsedUrl, headers).then(resolve).catch(reject);
      });

      req.setTimeout(12000, () => {
        req.destroy();
        Downloader.fallbackProbeWithRangedGet(parsedUrl, headers).then(resolve).catch(reject);
      });

      req.end();
    });
  }

  private static fallbackProbeWithRangedGet(parsedUrl: URL, headers: Record<string, string>): Promise<ProbeResult> {
    return new Promise((resolve, reject) => {
      const client = parsedUrl.protocol === 'https:' ? https : http;
      const rangedHeaders = { ...headers, Range: 'bytes=0-0' };

      const req = client.request(parsedUrl, { method: 'GET', headers: rangedHeaders }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, parsedUrl).toString();
          return Downloader.probeUrl(redirectUrl, headers).then(resolve).catch(reject);
        }

        const contentRange = res.headers['content-range'];
        const contentLength = res.headers['content-length'];
        const contentDisposition = res.headers['content-disposition'];
        const contentType = res.headers['content-type'] || 'application/octet-stream';
        const etag = res.headers['etag'];
        const lastModified = res.headers['last-modified'];

        let totalBytes = -1;
        let resumable = false;

        if (res.statusCode === 206 && contentRange) {
          resumable = true;
          // e.g. "bytes 0-0/123456"
          const match = contentRange.match(/\/(\d+)/);
          if (match) {
            totalBytes = parseInt(match[1], 10);
          }
        } else if (contentLength) {
          totalBytes = parseInt(contentLength, 10);
        }

        const filename = Downloader.extractFilename(contentDisposition, parsedUrl.pathname);
        const category = Downloader.categorize(filename, contentType);

        // Abort the response body since we only wanted headers
        req.destroy();

        resolve({
          url: parsedUrl.toString(),
          filename,
          totalBytes: isNaN(totalBytes) ? -1 : totalBytes,
          resumable,
          contentType,
          category,
          etag: Array.isArray(etag) ? etag[0] : etag,
          lastModified: Array.isArray(lastModified) ? lastModified[0] : lastModified,
        });
      });

      req.on('error', (err) => reject(err));
      req.setTimeout(12000, () => {
        req.destroy();
        reject(new Error('Connection timed out while probing URL'));
      });
      req.end();
    });
  }

  public static extractFilename(disposition?: string, pathname?: string): string {
    if (disposition) {
      // Try UTF-8 format: filename*=UTF-8''filename.ext
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      if (utf8Match && utf8Match[1]) {
        try {
          return decodeURIComponent(utf8Match[1].trim().replace(/['"]/g, ''));
        } catch {
          // ignore
        }
      }

      // Try regular format: filename="filename.ext"
      const match = disposition.match(/filename="?([^";]+)"?/i);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    if (pathname) {
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        const lastPart = parts[parts.length - 1];
        try {
          const clean = decodeURIComponent(lastPart).split('?')[0].split('#')[0];
          if (clean && clean.includes('.')) {
            return clean;
          }
        } catch {
          // ignore
        }
      }
    }

    return `download_${Date.now()}.bin`;
  }

  public static categorize(filename: string, contentType: string): FileCategory {
    const ext = path.extname(filename).toLowerCase();

    if (['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.iso', '.xz', '.zst'].includes(ext) ||
        contentType.includes('zip') || contentType.includes('compressed') || contentType.includes('tar')) {
      return 'Compressed';
    }

    if (['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.rtf', '.epub', '.odt'].includes(ext) ||
        contentType.includes('pdf') || contentType.includes('word') || contentType.includes('document')) {
      return 'Documents';
    }

    if (['.mp3', '.flac', '.wav', '.aac', '.ogg', '.m4a', '.wma', '.opus'].includes(ext) ||
        contentType.startsWith('audio/')) {
      return 'Music';
    }

    if (['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv', '.m4v', '.ts'].includes(ext) ||
        contentType.startsWith('video/')) {
      return 'Video';
    }

    if (['.exe', '.msi', '.dmg', '.pkg', '.deb', '.rpm', '.apk', '.iso', '.appimage', '.jar'].includes(ext) ||
        contentType.includes('executable') || contentType.includes('x-msdownload')) {
      return 'Programs';
    }

    return 'Other';
  }

  /**
   * Initialize download segments
   */
  public prepareSegments(): void {
    if (this.item.segments && this.item.segments.length > 0) {
      // Already has segments (e.g. resuming)
      return;
    }

    const total = this.item.totalBytes;
    const conns = this.item.connections || 8;

    if (!this.item.resumable || total <= 0 || conns <= 1) {
      // Single chunk
      this.item.segments = [{
        id: 0,
        start: 0,
        end: total > 0 ? total - 1 : -1,
        current: 0,
        downloaded: 0,
        speed: 0,
        status: 'idle',
      }];
      return;
    }

    // Split file into N segments
    const chunkSize = Math.floor(total / conns);
    const segments: DownloadSegment[] = [];

    for (let i = 0; i < conns; i++) {
      const start = i * chunkSize;
      const end = (i === conns - 1) ? total - 1 : (start + chunkSize - 1);
      segments.push({
        id: i,
        start,
        end,
        current: start,
        downloaded: 0,
        speed: 0,
        status: 'idle',
      });
    }

    this.item.segments = segments;
  }

  /**
   * Start or resume downloading
   */
  public async start(): Promise<void> {
    this.prepareSegments();
    this.item.status = 'downloading';
    this.abortController = new AbortController();
    this.activeStreams = [];

    try {
      // Ensure target directory exists
      const targetDir = path.dirname(this.item.savePath);
      if (!fs.existsSync(targetDir)) {
        await fs.promises.mkdir(targetDir, { recursive: true });
      }

      // Open target file for random access writing (r+ or w+ if creating)
      const fileExists = fs.existsSync(this.item.savePath);
      this.fileHandle = await fs.promises.open(
        this.item.savePath,
        fileExists ? 'r+' : 'w+'
      );

      // Pre-allocate sparse file if total length is known and file is new
      if (!fileExists && this.item.totalBytes > 0) {
        await this.fileHandle.truncate(this.item.totalBytes);
      }

      // Start ticker for calculating instantaneous download speed & ETA
      this.startProgressTicker();

      // Launch segment download workers
      const segmentPromises = this.item.segments.map((seg) => this.downloadSegment(seg));

      await Promise.all(segmentPromises);

      // Verify completion
      const allDone = this.item.segments.every((s) => s.status === 'completed');
      if (allDone) {
        this.item.status = 'completed';
        this.item.completedAt = Date.now();
        this.item.speed = 0;
        this.item.eta = 0;
        this.cleanup();
        this.onComplete(this.item);
      }
    } catch (err: any) {
      if (this.item.status === 'paused') {
        // Paused intentionally by user
        this.cleanup();
        return;
      }
      this.item.status = 'error';
      this.item.errorMessage = err.message || 'Download failed';
      this.item.speed = 0;
      this.cleanup();
      this.onError(this.item, err);
    }
  }

  /**
   * Download a single segment
   */
  private async downloadSegment(segment: DownloadSegment): Promise<void> {
    if (segment.status === 'completed') {
      return;
    }

    // Check if segment is already finished
    if (segment.end !== -1 && segment.current > segment.end) {
      segment.status = 'completed';
      return;
    }

    segment.status = 'downloading';

    return new Promise<void>((resolve, reject) => {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(this.item.url);
      } catch (err) {
        return reject(err);
      }

      const client = parsedUrl.protocol === 'https:' ? https : http;
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 HyperFetch/1.0',
        'Accept': '*/*',
        ...(this.item.headers || {}),
      };

      if (this.item.resumable && segment.end !== -1) {
        headers['Range'] = `bytes=${segment.current}-${segment.end}`;
      }

      let lastSegBytes = segment.downloaded;
      let lastTime = Date.now();

      const req = client.request(parsedUrl, { method: 'GET', headers }, (res) => {
        // Handle redirect within segment
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, parsedUrl).toString();
          this.item.url = redirectUrl;
          return this.downloadSegment(segment).then(resolve).catch(reject);
        }

        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          segment.status = 'error';
          return reject(new Error(`Server returned HTTP status ${res.statusCode}`));
        }

        // If server returned 200 OK instead of 206 Partial Content when multiple segments were planned:
        if (res.statusCode === 200 && this.item.resumable && segment.id > 0) {
          // Server ignored Range header! Only segment 0 can handle the stream.
          req.destroy();
          segment.status = 'completed';
          segment.speed = 0;
          return resolve();
        }

        if (res.statusCode === 200 && this.item.resumable && segment.id === 0) {
          // Fall back segment 0 to encompass the entire file
          segment.end = this.item.totalBytes > 0 ? this.item.totalBytes - 1 : -1;
        }

        this.activeStreams.push({ req, res });

        res.on('data', async (chunk: Buffer) => {
          if (!this.fileHandle || this.item.status !== 'downloading') {
            return;
          }

          let dataToWrite = chunk;
          if (segment.end !== -1 && segment.current + chunk.length > segment.end + 1) {
            const allowed = (segment.end + 1) - segment.current;
            if (allowed <= 0) {
              req.destroy();
              segment.status = 'completed';
              return resolve();
            }
            dataToWrite = chunk.subarray(0, allowed);
          }

          const writeOffset = segment.current;
          segment.current += dataToWrite.length;
          segment.downloaded += dataToWrite.length;
          this.item.downloadedBytes += dataToWrite.length;

          // Track segment speed
          const now = Date.now();
          const dt = (now - lastTime) / 1000;
          if (dt >= 0.5) {
            segment.speed = Math.round((segment.downloaded - lastSegBytes) / dt);
            lastSegBytes = segment.downloaded;
            lastTime = now;
          }

          try {
            await this.fileHandle.write(dataToWrite, 0, dataToWrite.length, writeOffset);
            if (segment.end !== -1 && segment.current >= segment.end + 1) {
              req.destroy();
              segment.status = 'completed';
              segment.speed = 0;
              this.tryDynamicReSegmentation();
              resolve();
            }
          } catch (writeErr) {
            segment.status = 'error';
            req.destroy();
            reject(writeErr);
          }
        });

        res.on('end', () => {
          segment.status = 'completed';
          segment.speed = 0;
          
          // IDM Dynamic Sub-Segmentation check:
          // If this segment finished and another segment still has a large unfinished range,
          // we could split that unfinished segment!
          this.tryDynamicReSegmentation();

          resolve();
        });

        res.on('error', (err) => {
          if (this.item.status === 'paused') {
            resolve();
            return;
          }
          segment.status = 'error';
          reject(err);
        });
      });

      req.on('error', (err) => {
        if (this.item.status === 'paused') {
          resolve();
          return;
        }
        segment.status = 'error';
        reject(err);
      });

      req.end();
    });
  }

  /**
   * IDM Signature Feature: Dynamic Re-segmentation
   * If a segment finishes early, find the active segment with the largest remaining byte range
   * and split it to saturate bandwidth!
   */
  private tryDynamicReSegmentation(): void {
    if (!this.item.resumable || this.item.status !== 'downloading') {
      return;
    }

    // Find active segments with at least 4MB remaining
    const MIN_SPLIT_SIZE = 4 * 1024 * 1024;
    let candidate: DownloadSegment | null = null;
    let maxRemaining = 0;

    for (const seg of this.item.segments) {
      if (seg.status === 'downloading' && seg.end > seg.current) {
        const remaining = seg.end - seg.current;
        if (remaining > maxRemaining && remaining >= MIN_SPLIT_SIZE) {
          maxRemaining = remaining;
          candidate = seg;
        }
      }
    }

    if (!candidate) {
      return;
    }

    // Split candidate remaining bytes in half
    const remaining = candidate.end - candidate.current;
    const splitPoint = candidate.current + Math.floor(remaining / 2);
    const oldEnd = candidate.end;

    // Adjust candidate end
    candidate.end = splitPoint;

    // Create new segment for the upper half
    const newSegment: DownloadSegment = {
      id: this.item.segments.length,
      start: splitPoint + 1,
      end: oldEnd,
      current: splitPoint + 1,
      downloaded: 0,
      speed: 0,
      status: 'idle',
    };

    this.item.segments.push(newSegment);

    // Launch worker on new segment
    this.downloadSegment(newSegment).catch((err) => {
      console.warn('Re-segmented worker encountered error:', err.message);
    });
  }

  private startProgressTicker(): void {
    this.lastSpeedCheckTime = Date.now();
    this.lastDownloadedBytes = this.item.downloadedBytes;

    this.progressInterval = setInterval(() => {
      if (this.item.status !== 'downloading') {
        return;
      }

      const now = Date.now();
      const dt = (now - this.lastSpeedCheckTime) / 1000;

      if (dt > 0.4) {
        const deltaBytes = this.item.downloadedBytes - this.lastDownloadedBytes;
        const currentSpeed = Math.max(0, Math.round(deltaBytes / dt));

        // Smooth speed via moving average of last 4 samples
        this.speedSamples.push(currentSpeed);
        if (this.speedSamples.length > 4) {
          this.speedSamples.shift();
        }
        const avgSpeed = Math.round(
          this.speedSamples.reduce((a, b) => a + b, 0) / this.speedSamples.length
        );

        this.item.speed = avgSpeed;
        this.lastDownloadedBytes = this.item.downloadedBytes;
        this.lastSpeedCheckTime = now;

        // Calculate ETA
        if (this.item.totalBytes > 0 && avgSpeed > 0) {
          const remainingBytes = Math.max(0, this.item.totalBytes - this.item.downloadedBytes);
          this.item.eta = Math.ceil(remainingBytes / avgSpeed);
        } else {
          this.item.eta = 0;
        }

        this.onProgress(this.item);
      }
    }, 500);
  }

  /**
   * Pause the active download
   */
  public async pause(): Promise<void> {
    this.item.status = 'paused';
    this.item.speed = 0;
    this.item.eta = 0;

    for (const { req } of this.activeStreams) {
      try {
        req.destroy();
      } catch {
        // ignore
      }
    }
    this.activeStreams = [];

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.cleanup();
    this.onProgress(this.item);
  }

  private cleanup(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }

    if (this.fileHandle) {
      this.fileHandle.close().catch(() => {});
      this.fileHandle = null;
    }
  }
}
