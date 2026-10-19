import { 
  DownloadItem, 
  NewDownloadOptions, 
  AppSettings, 
  ProbeResult, 
  DownloadStats 
} from '../shared/types';
import { ElectronAPI } from '../preload/preload';

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

const SERVER_URL = 'http://localhost:38241';
const WS_URL = 'ws://localhost:38241';

class ApiAdapter {
  private ws: WebSocket | null = null;
  private progressListeners: Set<(item: DownloadItem) => void> = new Set();
  private stateListeners: Set<(downloads: DownloadItem[]) => void> = new Set();
  private clipboardListeners: Set<(url: string) => void> = new Set();

  constructor() {
    if (!window.electronAPI) {
      this.initWebSocket();
    }
  }

  private initWebSocket() {
    try {
      this.ws = new WebSocket(WS_URL);
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'PROGRESS') {
            this.progressListeners.forEach(cb => cb(data.payload));
          } else if (data.type === 'STATE_CHANGE' || data.type === 'ALL') {
            this.stateListeners.forEach(cb => cb(data.payload));
          }
        } catch {
          // ignore
        }
      };
      this.ws.onclose = () => {
        setTimeout(() => this.initWebSocket(), 2000);
      };
    } catch {
      // ignore
    }
  }

  public async getDownloads(): Promise<DownloadItem[]> {
    if (window.electronAPI) {
      return window.electronAPI.getDownloads();
    }
    const res = await fetch(`${SERVER_URL}/api/downloads`);
    return res.json();
  }

  public async getStats(): Promise<DownloadStats> {
    if (window.electronAPI) {
      return window.electronAPI.getStats();
    }
    const res = await fetch(`${SERVER_URL}/api/stats`);
    return res.json();
  }

  public async getSettings(): Promise<AppSettings> {
    if (window.electronAPI) {
      return window.electronAPI.getSettings();
    }
    const res = await fetch(`${SERVER_URL}/api/settings`);
    return res.json();
  }

  public async saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    if (window.electronAPI) {
      return window.electronAPI.saveSettings(settings);
    }
    const res = await fetch(`${SERVER_URL}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return res.json();
  }

  public async probeUrl(url: string, headers?: Record<string, string>): Promise<ProbeResult> {
    if (window.electronAPI) {
      return window.electronAPI.probeUrl(url, headers);
    }
    const res = await fetch(`${SERVER_URL}/api/probe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, headers }),
    });
    return res.json();
  }

  public async addDownload(options: NewDownloadOptions): Promise<DownloadItem> {
    if (window.electronAPI) {
      return window.electronAPI.addDownload(options);
    }
    const res = await fetch(`${SERVER_URL}/api/downloads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    return res.json();
  }

  public async pauseDownload(id: string): Promise<void> {
    if (window.electronAPI) {
      return window.electronAPI.pauseDownload(id);
    }
    await fetch(`${SERVER_URL}/api/downloads/${id}/pause`, { method: 'POST' });
  }

  public async resumeDownload(id: string): Promise<void> {
    if (window.electronAPI) {
      return window.electronAPI.resumeDownload(id);
    }
    await fetch(`${SERVER_URL}/api/downloads/${id}/resume`, { method: 'POST' });
  }

  public async deleteDownload(id: string, deleteFile = false): Promise<void> {
    if (window.electronAPI) {
      return window.electronAPI.deleteDownload(id, deleteFile);
    }
    await fetch(`${SERVER_URL}/api/downloads/${id}?deleteFile=${deleteFile}`, { method: 'DELETE' });
  }

  public async pauseAll(): Promise<void> {
    if (window.electronAPI) {
      return window.electronAPI.pauseAll();
    }
    await fetch(`${SERVER_URL}/api/downloads/pause-all`, { method: 'POST' });
  }

  public async resumeAll(): Promise<void> {
    if (window.electronAPI) {
      return window.electronAPI.resumeAll();
    }
    await fetch(`${SERVER_URL}/api/downloads/resume-all`, { method: 'POST' });
  }

  public async openFile(filePath: string): Promise<void> {
    if (window.electronAPI) {
      return window.electronAPI.openFile(filePath);
    }
  }

  public async showInFolder(filePath: string): Promise<void> {
    if (window.electronAPI) {
      return window.electronAPI.showInFolder(filePath);
    }
  }

  public async selectDirectory(): Promise<string | null> {
    if (window.electronAPI) {
      return window.electronAPI.selectDirectory();
    }
    return null;
  }

  public onDownloadProgress(callback: (item: DownloadItem) => void): () => void {
    if (window.electronAPI) {
      return window.electronAPI.onDownloadProgress(callback);
    }
    this.progressListeners.add(callback);
    return () => this.progressListeners.delete(callback);
  }

  public onStateChange(callback: (downloads: DownloadItem[]) => void): () => void {
    if (window.electronAPI) {
      return window.electronAPI.onStateChange(callback);
    }
    this.stateListeners.add(callback);
    return () => this.stateListeners.delete(callback);
  }

  public onClipboardUrl(callback: (url: string) => void): () => void {
    if (window.electronAPI) {
      return window.electronAPI.onClipboardUrlDetected(callback);
    }
    this.clipboardListeners.add(callback);
    return () => this.clipboardListeners.delete(callback);
  }
}

export const api = new ApiAdapter();
