import fs from 'fs';
import path from 'path';
import os from 'os';
import { 
  DownloadItem, 
  AppSettings, 
  NewDownloadOptions, 
  ProbeResult, 
  DownloadStats 
} from '../../shared/types';
import { Downloader } from './Downloader';

export class DownloadManager {
  private downloads: Map<string, DownloadItem> = new Map();
  private downloaders: Map<string, Downloader> = new Map();
  private dataDir: string;
  private dbPath: string;
  private settingsPath: string;
  public settings: AppSettings;
  private listeners: Set<(item: DownloadItem) => void> = new Set();
  private stateListeners: Set<() => void> = new Set();

  constructor(customDataDir?: string) {
    this.dataDir = customDataDir || path.join(os.homedir(), '.hyperfetch');
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    this.dbPath = path.join(this.dataDir, 'downloads.json');
    this.settingsPath = path.join(this.dataDir, 'settings.json');

    this.settings = this.loadSettings();
    this.loadDownloads();
  }

  private loadSettings(): AppSettings {
    const defaultDownloads = path.join(os.homedir(), 'Downloads');
    const defaultSettings: AppSettings = {
      defaultDownloadDir: defaultDownloads,
      maxConcurrentDownloads: 3,
      defaultConnections: 8,
      speedLimitBytesPerSec: 0,
      clipboardWatch: true,
      notifyOnComplete: true,
      soundOnComplete: true,
      theme: 'dark',
    };

    try {
      if (fs.existsSync(this.settingsPath)) {
        const raw = fs.readFileSync(this.settingsPath, 'utf-8');
        return { ...defaultSettings, ...JSON.parse(raw) };
      }
    } catch {
      // ignore
    }
    return defaultSettings;
  }

  public saveSettings(newSettings: Partial<AppSettings>): AppSettings {
    this.settings = { ...this.settings, ...newSettings };
    try {
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
    return this.settings;
  }

  private loadDownloads(): void {
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf-8');
        const list: DownloadItem[] = JSON.parse(raw);
        for (const item of list) {
          // Reset interrupted downloads to paused
          if (item.status === 'downloading' || item.status === 'probing') {
            item.status = 'paused';
            item.speed = 0;
            item.eta = 0;
          }
          this.downloads.set(item.id, item);
        }
      }
    } catch (err) {
      console.error('Failed to load downloads:', err);
    }
  }

  public saveDownloads(): void {
    try {
      const list = Array.from(this.downloads.values());
      fs.writeFileSync(this.dbPath, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save downloads:', err);
    }
  }

  public onDownloadProgress(listener: (item: DownloadItem) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public onStateChange(listener: () => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private notifyItem(item: DownloadItem): void {
    for (const listener of this.listeners) {
      listener(item);
    }
  }

  private notifyStateChange(): void {
    this.saveDownloads();
    for (const listener of this.stateListeners) {
      listener();
    }
  }

  public getAll(): DownloadItem[] {
    return Array.from(this.downloads.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public getById(id: string): DownloadItem | undefined {
    return this.downloads.get(id);
  }

  public getStats(): DownloadStats {
    let totalSpeed = 0;
    let activeCount = 0;
    let queuedCount = 0;
    let completedCount = 0;

    for (const item of this.downloads.values()) {
      if (item.status === 'downloading') {
        activeCount++;
        totalSpeed += item.speed;
      } else if (item.status === 'idle') {
        queuedCount++;
      } else if (item.status === 'completed') {
        completedCount++;
      }
    }

    return { totalSpeed, activeCount, queuedCount, completedCount };
  }

  public async probe(url: string, headers?: Record<string, string>): Promise<ProbeResult> {
    return Downloader.probeUrl(url, headers);
  }

  public async add(options: NewDownloadOptions): Promise<DownloadItem> {
    const id = `dl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    // Probe metadata first
    const probe = await this.probe(options.url, options.headers);
    const filename = options.filename || probe.filename;
    
    let saveDir = options.savePath || this.settings.defaultDownloadDir;
    if (!saveDir || !fs.existsSync(saveDir)) {
      saveDir = path.join(os.homedir(), 'Downloads');
    }
    try {
      if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir, { recursive: true });
      }
    } catch {
      saveDir = os.homedir();
    }
    const finalSavePath = path.join(saveDir, filename);

    const item: DownloadItem = {
      id,
      url: probe.url,
      filename,
      savePath: finalSavePath,
      totalBytes: probe.totalBytes,
      downloadedBytes: 0,
      status: 'idle',
      speed: 0,
      eta: 0,
      resumable: probe.resumable,
      connections: options.connections || this.settings.defaultConnections,
      segments: [],
      category: probe.category,
      createdAt: Date.now(),
      headers: options.headers,
      etag: probe.etag,
      lastModified: probe.lastModified,
    };

    this.downloads.set(id, item);
    this.notifyStateChange();

    if (options.startImmediately !== false) {
      this.start(id);
    }

    return item;
  }

  public async start(id: string): Promise<void> {
    const item = this.downloads.get(id);
    if (!item) return;

    if (item.status === 'downloading') return;

    // Concurrency check
    const activeCount = Array.from(this.downloads.values()).filter(d => d.status === 'downloading').length;
    if (activeCount >= this.settings.maxConcurrentDownloads) {
      item.status = 'idle'; // queued
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
    item.status = 'downloading';
    this.notifyStateChange();

    downloader.start().catch((err) => {
      console.error(`Download ${id} error:`, err);
    });
  }

  public async pause(id: string): Promise<void> {
    const downloader = this.downloaders.get(id);
    if (downloader) {
      await downloader.pause();
      this.downloaders.delete(id);
    } else {
      const item = this.downloads.get(id);
      if (item) {
        item.status = 'paused';
        item.speed = 0;
        item.eta = 0;
      }
    }
    this.notifyStateChange();
    this.processQueue();
  }

  public async resume(id: string): Promise<void> {
    await this.start(id);
  }

  public async pauseAll(): Promise<void> {
    const ids = Array.from(this.downloaders.keys());
    for (const id of ids) {
      await this.pause(id);
    }
  }

  public async resumeAll(): Promise<void> {
    for (const item of this.downloads.values()) {
      if (item.status === 'paused' || item.status === 'idle' || item.status === 'error') {
        await this.start(item.id);
      }
    }
  }

  public async remove(id: string, deleteFile: boolean = false): Promise<void> {
    await this.pause(id);
    const item = this.downloads.get(id);
    if (item && deleteFile && fs.existsSync(item.savePath)) {
      try {
        await fs.promises.unlink(item.savePath);
      } catch (err) {
        console.warn('Failed to delete file from disk:', err);
      }
    }
    this.downloads.delete(id);
    this.notifyStateChange();
    this.processQueue();
  }

  private processQueue(): void {
    const activeCount = Array.from(this.downloads.values()).filter(d => d.status === 'downloading').length;
    if (activeCount >= this.settings.maxConcurrentDownloads) {
      return;
    }

    const queued = Array.from(this.downloads.values()).find(d => d.status === 'idle');
    if (queued) {
      this.start(queued.id);
    }
  }
}
