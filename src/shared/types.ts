export type DownloadStatus = 
  | 'idle' 
  | 'probing' 
  | 'downloading' 
  | 'paused' 
  | 'completed' 
  | 'error';

export type FileCategory = 
  | 'All' 
  | 'Compressed' 
  | 'Documents' 
  | 'Music' 
  | 'Video' 
  | 'Programs' 
  | 'Other';

export interface DownloadSegment {
  id: number;
  start: number;
  end: number;
  current: number;
  downloaded: number;
  speed: number;
  status: 'idle' | 'downloading' | 'completed' | 'error';
}

export interface DownloadItem {
  id: string;
  url: string;
  filename: string;
  savePath: string;
  totalBytes: number;
  downloadedBytes: number;
  status: DownloadStatus;
  speed: number; // bytes/sec
  eta: number; // seconds remaining
  resumable: boolean;
  connections: number;
  segments: DownloadSegment[];
  category: FileCategory;
  createdAt: number;
  completedAt?: number;
  errorMessage?: string;
  headers?: Record<string, string>;
  etag?: string;
  lastModified?: string;
}

export interface AppSettings {
  defaultDownloadDir: string;
  maxConcurrentDownloads: number;
  defaultConnections: number;
  speedLimitBytesPerSec: number; // 0 = unlimited
  clipboardWatch: boolean;
  notifyOnComplete: boolean;
  soundOnComplete: boolean;
  theme: 'dark' | 'light' | 'system';
}

export interface NewDownloadOptions {
  url: string;
  savePath?: string;
  filename?: string;
  connections?: number;
  headers?: Record<string, string>;
  startImmediately?: boolean;
}

export interface ProbeResult {
  url: string;
  filename: string;
  totalBytes: number;
  resumable: boolean;
  contentType: string;
  category: FileCategory;
  etag?: string;
  lastModified?: string;
}

export interface DownloadStats {
  totalSpeed: number;
  activeCount: number;
  queuedCount: number;
  completedCount: number;
}
