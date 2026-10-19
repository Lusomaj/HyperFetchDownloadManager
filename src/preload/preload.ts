import { contextBridge, ipcRenderer } from 'electron';
import { DownloadItem, NewDownloadOptions, AppSettings, ProbeResult, DownloadStats } from '../shared/types';

export interface ElectronAPI {
  getDownloads: () => Promise<DownloadItem[]>;
  getStats: () => Promise<DownloadStats>;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  probeUrl: (url: string, headers?: Record<string, string>) => Promise<ProbeResult>;
  addDownload: (options: NewDownloadOptions) => Promise<DownloadItem>;
  pauseDownload: (id: string) => Promise<void>;
  resumeDownload: (id: string) => Promise<void>;
  deleteDownload: (id: string, deleteFile?: boolean) => Promise<void>;
  pauseAll: () => Promise<void>;
  resumeAll: () => Promise<void>;
  openFile: (filePath: string) => Promise<void>;
  showInFolder: (filePath: string) => Promise<void>;
  selectDirectory: () => Promise<string | null>;
  onDownloadProgress: (callback: (item: DownloadItem) => void) => () => void;
  onStateChange: (callback: (downloads: DownloadItem[]) => void) => () => void;
  onClipboardUrlDetected: (callback: (url: string) => void) => () => void;
}

const electronAPI: ElectronAPI = {
  getDownloads: () => ipcRenderer.invoke('get-downloads'),
  getStats: () => ipcRenderer.invoke('get-stats'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  probeUrl: (url, headers) => ipcRenderer.invoke('probe-url', { url, headers }),
  addDownload: (options) => ipcRenderer.invoke('add-download', options),
  pauseDownload: (id) => ipcRenderer.invoke('pause-download', id),
  resumeDownload: (id) => ipcRenderer.invoke('resume-download', id),
  deleteDownload: (id, deleteFile) => ipcRenderer.invoke('delete-download', { id, deleteFile }),
  pauseAll: () => ipcRenderer.invoke('pause-all'),
  resumeAll: () => ipcRenderer.invoke('resume-all'),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  onDownloadProgress: (callback) => {
    const handler = (_: any, item: DownloadItem) => callback(item);
    ipcRenderer.on('download-progress', handler);
    return () => ipcRenderer.removeListener('download-progress', handler);
  },
  onStateChange: (callback) => {
    const handler = (_: any, list: DownloadItem[]) => callback(list);
    ipcRenderer.on('state-change', handler);
    return () => ipcRenderer.removeListener('state-change', handler);
  },
  onClipboardUrlDetected: (callback) => {
    const handler = (_: any, url: string) => callback(url);
    ipcRenderer.on('clipboard-url', handler);
    return () => ipcRenderer.removeListener('clipboard-url', handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
