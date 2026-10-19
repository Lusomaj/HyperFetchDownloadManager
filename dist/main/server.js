"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main/server.ts
var server_exports = {};
__export(server_exports, {
  manager: () => manager,
  server: () => server
});
module.exports = __toCommonJS(server_exports);
var import_http2 = __toESM(require("http"));
var import_ws = require("ws");
var import_url2 = require("url");

// src/main/engine/DownloadManager.ts
var import_fs2 = __toESM(require("fs"));
var import_path2 = __toESM(require("path"));
var import_os = __toESM(require("os"));

// src/main/engine/Downloader.ts
var import_http = __toESM(require("http"));
var import_https = __toESM(require("https"));
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_url = require("url");
var Downloader = class _Downloader {
  constructor(item, onProgress, onComplete, onError) {
    this.item = item;
    this.onProgress = onProgress;
    this.onComplete = onComplete;
    this.onError = onError;
  }
  abortController = null;
  fileHandle = null;
  activeStreams = [];
  lastSpeedCheckTime = Date.now();
  lastDownloadedBytes = 0;
  speedSamples = [];
  progressInterval = null;
  /**
   * Probe a URL using HEAD or ranged GET to discover file metadata
   */
  static async probeUrl(targetUrl, customHeaders) {
    return new Promise((resolve, reject) => {
      let parsedUrl;
      try {
        parsedUrl = new import_url.URL(targetUrl);
      } catch (err) {
        return reject(new Error("Invalid URL format"));
      }
      const client = parsedUrl.protocol === "https:" ? import_https.default : import_http.default;
      const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 HyperFetch/1.0",
        "Accept": "*/*",
        ...customHeaders || {}
      };
      const req = client.request(parsedUrl, { method: "HEAD", headers }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new import_url.URL(res.headers.location, parsedUrl).toString();
          return _Downloader.probeUrl(redirectUrl, customHeaders).then(resolve).catch(reject);
        }
        if (res.statusCode && res.statusCode >= 400 && res.statusCode !== 405) {
          return _Downloader.fallbackProbeWithRangedGet(parsedUrl, headers).then(resolve).catch(reject);
        }
        const acceptRanges = res.headers["accept-ranges"];
        const contentLength = res.headers["content-length"];
        const contentDisposition = res.headers["content-disposition"];
        const contentType = res.headers["content-type"] || "application/octet-stream";
        const etag = res.headers["etag"];
        const lastModified = res.headers["last-modified"];
        const totalBytes = contentLength ? parseInt(contentLength, 10) : -1;
        const resumable = acceptRanges === "bytes";
        const filename = _Downloader.extractFilename(contentDisposition, parsedUrl.pathname);
        const category = _Downloader.categorize(filename, contentType);
        resolve({
          url: targetUrl,
          filename,
          totalBytes: isNaN(totalBytes) ? -1 : totalBytes,
          resumable,
          contentType,
          category,
          etag: Array.isArray(etag) ? etag[0] : etag,
          lastModified: Array.isArray(lastModified) ? lastModified[0] : lastModified
        });
      });
      req.on("error", () => {
        _Downloader.fallbackProbeWithRangedGet(parsedUrl, headers).then(resolve).catch(reject);
      });
      req.setTimeout(12e3, () => {
        req.destroy();
        _Downloader.fallbackProbeWithRangedGet(parsedUrl, headers).then(resolve).catch(reject);
      });
      req.end();
    });
  }
  static fallbackProbeWithRangedGet(parsedUrl, headers) {
    return new Promise((resolve, reject) => {
      const client = parsedUrl.protocol === "https:" ? import_https.default : import_http.default;
      const rangedHeaders = { ...headers, Range: "bytes=0-0" };
      const req = client.request(parsedUrl, { method: "GET", headers: rangedHeaders }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new import_url.URL(res.headers.location, parsedUrl).toString();
          return _Downloader.probeUrl(redirectUrl, headers).then(resolve).catch(reject);
        }
        const contentRange = res.headers["content-range"];
        const contentLength = res.headers["content-length"];
        const contentDisposition = res.headers["content-disposition"];
        const contentType = res.headers["content-type"] || "application/octet-stream";
        const etag = res.headers["etag"];
        const lastModified = res.headers["last-modified"];
        let totalBytes = -1;
        let resumable = false;
        if (res.statusCode === 206 && contentRange) {
          resumable = true;
          const match = contentRange.match(/\/(\d+)/);
          if (match) {
            totalBytes = parseInt(match[1], 10);
          }
        } else if (contentLength) {
          totalBytes = parseInt(contentLength, 10);
        }
        const filename = _Downloader.extractFilename(contentDisposition, parsedUrl.pathname);
        const category = _Downloader.categorize(filename, contentType);
        req.destroy();
        resolve({
          url: parsedUrl.toString(),
          filename,
          totalBytes: isNaN(totalBytes) ? -1 : totalBytes,
          resumable,
          contentType,
          category,
          etag: Array.isArray(etag) ? etag[0] : etag,
          lastModified: Array.isArray(lastModified) ? lastModified[0] : lastModified
        });
      });
      req.on("error", (err) => reject(err));
      req.setTimeout(12e3, () => {
        req.destroy();
        reject(new Error("Connection timed out while probing URL"));
      });
      req.end();
    });
  }
  static extractFilename(disposition, pathname) {
    if (disposition) {
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      if (utf8Match && utf8Match[1]) {
        try {
          return decodeURIComponent(utf8Match[1].trim().replace(/['"]/g, ""));
        } catch {
        }
      }
      const match = disposition.match(/filename="?([^";]+)"?/i);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    if (pathname) {
      const parts = pathname.split("/").filter(Boolean);
      if (parts.length > 0) {
        const lastPart = parts[parts.length - 1];
        try {
          const clean = decodeURIComponent(lastPart).split("?")[0].split("#")[0];
          if (clean && clean.includes(".")) {
            return clean;
          }
        } catch {
        }
      }
    }
    return `download_${Date.now()}.bin`;
  }
  static categorize(filename, contentType) {
    const ext = import_path.default.extname(filename).toLowerCase();
    if ([".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".iso", ".xz", ".zst"].includes(ext) || contentType.includes("zip") || contentType.includes("compressed") || contentType.includes("tar")) {
      return "Compressed";
    }
    if ([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv", ".rtf", ".epub", ".odt"].includes(ext) || contentType.includes("pdf") || contentType.includes("word") || contentType.includes("document")) {
      return "Documents";
    }
    if ([".mp3", ".flac", ".wav", ".aac", ".ogg", ".m4a", ".wma", ".opus"].includes(ext) || contentType.startsWith("audio/")) {
      return "Music";
    }
    if ([".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv", ".m4v", ".ts"].includes(ext) || contentType.startsWith("video/")) {
      return "Video";
    }
    if ([".exe", ".msi", ".dmg", ".pkg", ".deb", ".rpm", ".apk", ".iso", ".appimage", ".jar"].includes(ext) || contentType.includes("executable") || contentType.includes("x-msdownload")) {
      return "Programs";
    }
    return "Other";
  }
  /**
   * Initialize download segments
   */
  prepareSegments() {
    if (this.item.segments && this.item.segments.length > 0) {
      return;
    }
    const total = this.item.totalBytes;
    const conns = this.item.connections || 8;
    if (!this.item.resumable || total <= 0 || conns <= 1) {
      this.item.segments = [{
        id: 0,
        start: 0,
        end: total > 0 ? total - 1 : -1,
        current: 0,
        downloaded: 0,
        speed: 0,
        status: "idle"
      }];
      return;
    }
    const chunkSize = Math.floor(total / conns);
    const segments = [];
    for (let i = 0; i < conns; i++) {
      const start = i * chunkSize;
      const end = i === conns - 1 ? total - 1 : start + chunkSize - 1;
      segments.push({
        id: i,
        start,
        end,
        current: start,
        downloaded: 0,
        speed: 0,
        status: "idle"
      });
    }
    this.item.segments = segments;
  }
  /**
   * Start or resume downloading
   */
  async start() {
    this.prepareSegments();
    this.item.status = "downloading";
    this.abortController = new AbortController();
    this.activeStreams = [];
    try {
      const targetDir = import_path.default.dirname(this.item.savePath);
      if (!import_fs.default.existsSync(targetDir)) {
        await import_fs.default.promises.mkdir(targetDir, { recursive: true });
      }
      const fileExists = import_fs.default.existsSync(this.item.savePath);
      this.fileHandle = await import_fs.default.promises.open(
        this.item.savePath,
        fileExists ? "r+" : "w+"
      );
      if (!fileExists && this.item.totalBytes > 0) {
        await this.fileHandle.truncate(this.item.totalBytes);
      }
      this.startProgressTicker();
      const segmentPromises = this.item.segments.map((seg) => this.downloadSegment(seg));
      await Promise.all(segmentPromises);
      const allDone = this.item.segments.every((s) => s.status === "completed");
      if (allDone) {
        this.item.status = "completed";
        this.item.completedAt = Date.now();
        this.item.speed = 0;
        this.item.eta = 0;
        this.cleanup();
        this.onComplete(this.item);
      }
    } catch (err) {
      if (this.item.status === "paused") {
        this.cleanup();
        return;
      }
      this.item.status = "error";
      this.item.errorMessage = err.message || "Download failed";
      this.item.speed = 0;
      this.cleanup();
      this.onError(this.item, err);
    }
  }
  /**
   * Download a single segment
   */
  async downloadSegment(segment) {
    if (segment.status === "completed") {
      return;
    }
    if (segment.end !== -1 && segment.current > segment.end) {
      segment.status = "completed";
      return;
    }
    segment.status = "downloading";
    return new Promise((resolve, reject) => {
      let parsedUrl;
      try {
        parsedUrl = new import_url.URL(this.item.url);
      } catch (err) {
        return reject(err);
      }
      const client = parsedUrl.protocol === "https:" ? import_https.default : import_http.default;
      const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 HyperFetch/1.0",
        "Accept": "*/*",
        ...this.item.headers || {}
      };
      if (this.item.resumable && segment.end !== -1) {
        headers["Range"] = `bytes=${segment.current}-${segment.end}`;
      }
      let lastSegBytes = segment.downloaded;
      let lastTime = Date.now();
      const req = client.request(parsedUrl, { method: "GET", headers }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new import_url.URL(res.headers.location, parsedUrl).toString();
          this.item.url = redirectUrl;
          return this.downloadSegment(segment).then(resolve).catch(reject);
        }
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          segment.status = "error";
          return reject(new Error(`Server returned HTTP status ${res.statusCode}`));
        }
        if (res.statusCode === 200 && this.item.resumable && segment.id > 0) {
          req.destroy();
          segment.status = "completed";
          segment.speed = 0;
          return resolve();
        }
        if (res.statusCode === 200 && this.item.resumable && segment.id === 0) {
          segment.end = this.item.totalBytes > 0 ? this.item.totalBytes - 1 : -1;
        }
        this.activeStreams.push({ req, res });
        res.on("data", async (chunk) => {
          if (!this.fileHandle || this.item.status !== "downloading") {
            return;
          }
          let dataToWrite = chunk;
          if (segment.end !== -1 && segment.current + chunk.length > segment.end + 1) {
            const allowed = segment.end + 1 - segment.current;
            if (allowed <= 0) {
              req.destroy();
              segment.status = "completed";
              return resolve();
            }
            dataToWrite = chunk.subarray(0, allowed);
          }
          const writeOffset = segment.current;
          segment.current += dataToWrite.length;
          segment.downloaded += dataToWrite.length;
          this.item.downloadedBytes += dataToWrite.length;
          const now = Date.now();
          const dt = (now - lastTime) / 1e3;
          if (dt >= 0.5) {
            segment.speed = Math.round((segment.downloaded - lastSegBytes) / dt);
            lastSegBytes = segment.downloaded;
            lastTime = now;
          }
          try {
            await this.fileHandle.write(dataToWrite, 0, dataToWrite.length, writeOffset);
            if (segment.end !== -1 && segment.current >= segment.end + 1) {
              req.destroy();
              segment.status = "completed";
              segment.speed = 0;
              this.tryDynamicReSegmentation();
              resolve();
            }
          } catch (writeErr) {
            segment.status = "error";
            req.destroy();
            reject(writeErr);
          }
        });
        res.on("end", () => {
          segment.status = "completed";
          segment.speed = 0;
          this.tryDynamicReSegmentation();
          resolve();
        });
        res.on("error", (err) => {
          if (this.item.status === "paused") {
            resolve();
            return;
          }
          segment.status = "error";
          reject(err);
        });
      });
      req.on("error", (err) => {
        if (this.item.status === "paused") {
          resolve();
          return;
        }
        segment.status = "error";
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
  tryDynamicReSegmentation() {
    if (!this.item.resumable || this.item.status !== "downloading") {
      return;
    }
    const MIN_SPLIT_SIZE = 4 * 1024 * 1024;
    let candidate = null;
    let maxRemaining = 0;
    for (const seg of this.item.segments) {
      if (seg.status === "downloading" && seg.end > seg.current) {
        const remaining2 = seg.end - seg.current;
        if (remaining2 > maxRemaining && remaining2 >= MIN_SPLIT_SIZE) {
          maxRemaining = remaining2;
          candidate = seg;
        }
      }
    }
    if (!candidate) {
      return;
    }
    const remaining = candidate.end - candidate.current;
    const splitPoint = candidate.current + Math.floor(remaining / 2);
    const oldEnd = candidate.end;
    candidate.end = splitPoint;
    const newSegment = {
      id: this.item.segments.length,
      start: splitPoint + 1,
      end: oldEnd,
      current: splitPoint + 1,
      downloaded: 0,
      speed: 0,
      status: "idle"
    };
    this.item.segments.push(newSegment);
    this.downloadSegment(newSegment).catch((err) => {
      console.warn("Re-segmented worker encountered error:", err.message);
    });
  }
  startProgressTicker() {
    this.lastSpeedCheckTime = Date.now();
    this.lastDownloadedBytes = this.item.downloadedBytes;
    this.progressInterval = setInterval(() => {
      if (this.item.status !== "downloading") {
        return;
      }
      const now = Date.now();
      const dt = (now - this.lastSpeedCheckTime) / 1e3;
      if (dt > 0.4) {
        const deltaBytes = this.item.downloadedBytes - this.lastDownloadedBytes;
        const currentSpeed = Math.max(0, Math.round(deltaBytes / dt));
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
  async pause() {
    this.item.status = "paused";
    this.item.speed = 0;
    this.item.eta = 0;
    for (const { req } of this.activeStreams) {
      try {
        req.destroy();
      } catch {
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
  cleanup() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    if (this.fileHandle) {
      this.fileHandle.close().catch(() => {
      });
      this.fileHandle = null;
    }
  }
};

// src/main/engine/DownloadManager.ts
var DownloadManager = class {
  downloads = /* @__PURE__ */ new Map();
  downloaders = /* @__PURE__ */ new Map();
  dataDir;
  dbPath;
  settingsPath;
  settings;
  listeners = /* @__PURE__ */ new Set();
  stateListeners = /* @__PURE__ */ new Set();
  constructor(customDataDir) {
    this.dataDir = customDataDir || import_path2.default.join(import_os.default.homedir(), ".hyperfetch");
    if (!import_fs2.default.existsSync(this.dataDir)) {
      import_fs2.default.mkdirSync(this.dataDir, { recursive: true });
    }
    this.dbPath = import_path2.default.join(this.dataDir, "downloads.json");
    this.settingsPath = import_path2.default.join(this.dataDir, "settings.json");
    this.settings = this.loadSettings();
    this.loadDownloads();
  }
  loadSettings() {
    const defaultDownloads = import_path2.default.join(import_os.default.homedir(), "Downloads");
    const defaultSettings = {
      defaultDownloadDir: defaultDownloads,
      maxConcurrentDownloads: 3,
      defaultConnections: 8,
      speedLimitBytesPerSec: 0,
      clipboardWatch: true,
      notifyOnComplete: true,
      soundOnComplete: true,
      theme: "dark"
    };
    try {
      if (import_fs2.default.existsSync(this.settingsPath)) {
        const raw = import_fs2.default.readFileSync(this.settingsPath, "utf-8");
        return { ...defaultSettings, ...JSON.parse(raw) };
      }
    } catch {
    }
    return defaultSettings;
  }
  saveSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      import_fs2.default.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
    return this.settings;
  }
  loadDownloads() {
    try {
      if (import_fs2.default.existsSync(this.dbPath)) {
        const raw = import_fs2.default.readFileSync(this.dbPath, "utf-8");
        const list = JSON.parse(raw);
        for (const item of list) {
          if (item.status === "downloading" || item.status === "probing") {
            item.status = "paused";
            item.speed = 0;
            item.eta = 0;
          }
          this.downloads.set(item.id, item);
        }
      }
    } catch (err) {
      console.error("Failed to load downloads:", err);
    }
  }
  saveDownloads() {
    try {
      const list = Array.from(this.downloads.values());
      import_fs2.default.writeFileSync(this.dbPath, JSON.stringify(list, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to save downloads:", err);
    }
  }
  onDownloadProgress(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  onStateChange(listener) {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }
  notifyItem(item) {
    for (const listener of this.listeners) {
      listener(item);
    }
  }
  notifyStateChange() {
    this.saveDownloads();
    for (const listener of this.stateListeners) {
      listener();
    }
  }
  getAll() {
    return Array.from(this.downloads.values()).sort((a, b) => b.createdAt - a.createdAt);
  }
  getById(id) {
    return this.downloads.get(id);
  }
  getStats() {
    let totalSpeed = 0;
    let activeCount = 0;
    let queuedCount = 0;
    let completedCount = 0;
    for (const item of this.downloads.values()) {
      if (item.status === "downloading") {
        activeCount++;
        totalSpeed += item.speed;
      } else if (item.status === "idle") {
        queuedCount++;
      } else if (item.status === "completed") {
        completedCount++;
      }
    }
    return { totalSpeed, activeCount, queuedCount, completedCount };
  }
  async probe(url, headers) {
    return Downloader.probeUrl(url, headers);
  }
  async add(options) {
    const id = `dl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const probe = await this.probe(options.url, options.headers);
    const filename = options.filename || probe.filename;
    let saveDir = options.savePath || this.settings.defaultDownloadDir;
    if (!saveDir || !import_fs2.default.existsSync(saveDir)) {
      saveDir = import_path2.default.join(import_os.default.homedir(), "Downloads");
    }
    try {
      if (!import_fs2.default.existsSync(saveDir)) {
        import_fs2.default.mkdirSync(saveDir, { recursive: true });
      }
    } catch {
      saveDir = import_os.default.homedir();
    }
    const finalSavePath = import_path2.default.join(saveDir, filename);
    const item = {
      id,
      url: probe.url,
      filename,
      savePath: finalSavePath,
      totalBytes: probe.totalBytes,
      downloadedBytes: 0,
      status: "idle",
      speed: 0,
      eta: 0,
      resumable: probe.resumable,
      connections: options.connections || this.settings.defaultConnections,
      segments: [],
      category: probe.category,
      createdAt: Date.now(),
      headers: options.headers,
      etag: probe.etag,
      lastModified: probe.lastModified
    };
    this.downloads.set(id, item);
    this.notifyStateChange();
    if (options.startImmediately !== false) {
      this.start(id);
    }
    return item;
  }
  async start(id) {
    const item = this.downloads.get(id);
    if (!item)
      return;
    if (item.status === "downloading")
      return;
    const activeCount = Array.from(this.downloads.values()).filter((d) => d.status === "downloading").length;
    if (activeCount >= this.settings.maxConcurrentDownloads) {
      item.status = "idle";
      this.notifyStateChange();
      return;
    }
    const downloader = new Downloader(
      item,
      (updated) => {
        this.notifyItem(updated);
      },
      (completed) => {
        this.downloaders.delete(id);
        this.notifyStateChange();
        this.processQueue();
      },
      (failed, error) => {
        this.downloaders.delete(id);
        this.notifyStateChange();
        this.processQueue();
      }
    );
    this.downloaders.set(id, downloader);
    item.status = "downloading";
    this.notifyStateChange();
    downloader.start().catch((err) => {
      console.error(`Download ${id} error:`, err);
    });
  }
  async pause(id) {
    const downloader = this.downloaders.get(id);
    if (downloader) {
      await downloader.pause();
      this.downloaders.delete(id);
    } else {
      const item = this.downloads.get(id);
      if (item) {
        item.status = "paused";
        item.speed = 0;
        item.eta = 0;
      }
    }
    this.notifyStateChange();
    this.processQueue();
  }
  async resume(id) {
    await this.start(id);
  }
  async pauseAll() {
    const ids = Array.from(this.downloaders.keys());
    for (const id of ids) {
      await this.pause(id);
    }
  }
  async resumeAll() {
    for (const item of this.downloads.values()) {
      if (item.status === "paused" || item.status === "idle" || item.status === "error") {
        await this.start(item.id);
      }
    }
  }
  async remove(id, deleteFile = false) {
    await this.pause(id);
    const item = this.downloads.get(id);
    if (item && deleteFile && import_fs2.default.existsSync(item.savePath)) {
      try {
        await import_fs2.default.promises.unlink(item.savePath);
      } catch (err) {
        console.warn("Failed to delete file from disk:", err);
      }
    }
    this.downloads.delete(id);
    this.notifyStateChange();
    this.processQueue();
  }
  processQueue() {
    const activeCount = Array.from(this.downloads.values()).filter((d) => d.status === "downloading").length;
    if (activeCount >= this.settings.maxConcurrentDownloads) {
      return;
    }
    const queued = Array.from(this.downloads.values()).find((d) => d.status === "idle");
    if (queued) {
      this.start(queued.id);
    }
  }
};

// src/main/server.ts
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 38241;
var manager = new DownloadManager();
var server = import_http2.default.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const parsedUrl = new import_url2.URL(req.url || "/", `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const sendJson = (data, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  const getBody = () => {
    return new Promise((resolve) => {
      let body = "";
      req.on("data", (chunk) => body += chunk);
      req.on("end", () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch {
          resolve({});
        }
      });
    });
  };
  try {
    if (req.method === "GET" && pathname === "/api/downloads") {
      return sendJson(manager.getAll());
    }
    if (req.method === "GET" && pathname === "/api/stats") {
      return sendJson(manager.getStats());
    }
    if (req.method === "GET" && pathname === "/api/settings") {
      return sendJson(manager.settings);
    }
    if (req.method === "POST" && pathname === "/api/settings") {
      const body = await getBody();
      return sendJson(manager.saveSettings(body));
    }
    if (req.method === "POST" && pathname === "/api/probe") {
      const body = await getBody();
      const result = await manager.probe(body.url, body.headers);
      return sendJson(result);
    }
    if (req.method === "POST" && pathname === "/api/downloads") {
      const body = await getBody();
      const item = await manager.add(body);
      return sendJson(item, 201);
    }
    const matchAction = pathname.match(/^\/api\/downloads\/([^\/]+)\/([^\/]+)$/);
    if (matchAction) {
      const [, id, action] = matchAction;
      if (action === "pause") {
        await manager.pause(id);
        return sendJson({ success: true });
      }
      if (action === "resume") {
        await manager.resume(id);
        return sendJson({ success: true });
      }
    }
    const matchDelete = pathname.match(/^\/api\/downloads\/([^\/]+)$/);
    if (req.method === "DELETE" && matchDelete) {
      const id = matchDelete[1];
      const deleteFile = parsedUrl.searchParams.get("deleteFile") === "true";
      await manager.remove(id, deleteFile);
      return sendJson({ success: true });
    }
    if (req.method === "POST" && pathname === "/api/downloads/pause-all") {
      await manager.pauseAll();
      return sendJson({ success: true });
    }
    if (req.method === "POST" && pathname === "/api/downloads/resume-all") {
      await manager.resumeAll();
      return sendJson({ success: true });
    }
    sendJson({ error: "Not found" }, 404);
  } catch (err) {
    sendJson({ error: err.message || "Internal server error" }, 500);
  }
});
var wss = new import_ws.WebSocketServer({ server });
wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "ALL", payload: manager.getAll() }));
  ws.send(JSON.stringify({ type: "STATS", payload: manager.getStats() }));
  const progressUnsub = manager.onDownloadProgress((item) => {
    if (ws.readyState === import_ws.WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "PROGRESS", payload: item }));
    }
  });
  const stateUnsub = manager.onStateChange(() => {
    if (ws.readyState === import_ws.WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "STATE_CHANGE", payload: manager.getAll() }));
      ws.send(JSON.stringify({ type: "STATS", payload: manager.getStats() }));
    }
  });
  ws.on("close", () => {
    progressUnsub();
    stateUnsub();
  });
});
server.listen(PORT, () => {
  console.log(`[HyperFetch Server] Engine running at http://localhost:${PORT}`);
  console.log(`[HyperFetch Server] WebSocket listening at ws://localhost:${PORT}`);
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  manager,
  server
});
//# sourceMappingURL=server.js.map
