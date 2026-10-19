import { app, BrowserWindow, ipcMain, dialog, shell, clipboard } from 'electron';
import path from 'path';
import { DownloadManager } from './engine/DownloadManager';
import { NewDownloadOptions, AppSettings } from '../shared/types';

let mainWindow: BrowserWindow | null = null;
const manager = new DownloadManager();
let lastClipboardText = '';
let clipboardInterval: NodeJS.Timeout | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 550,
    title: 'HyperFetch - Advanced Download Accelerator',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    frame: true,
    show: false,
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Setup manager event forwards to renderer
  manager.onDownloadProgress((item) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download-progress', item);
    }
  });

  manager.onStateChange(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('state-change', manager.getAll());
    }
  });

  // Clipboard URL monitor
  startClipboardWatcher();
}

function startClipboardWatcher() {
  if (clipboardInterval) clearInterval(clipboardInterval);

  clipboardInterval = setInterval(() => {
    if (!manager.settings.clipboardWatch) return;
    
    try {
      const text = clipboard.readText().trim();
      if (text && text !== lastClipboardText) {
        lastClipboardText = text;
        if (/^https?:\/\/.+/i.test(text)) {
          // Check if likely a download link
          if (/\.(zip|rar|7z|tar|gz|iso|exe|msi|dmg|pkg|deb|rpm|mp4|mkv|webm|mp3|flac|wav|pdf|epub|doc|docx)($|\?)/i.test(text)) {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('clipboard-url', text);
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }, 1500);
}

// Register IPC handlers
ipcMain.handle('get-downloads', () => {
  return manager.getAll();
});

ipcMain.handle('get-stats', () => {
  return manager.getStats();
});

ipcMain.handle('get-settings', () => {
  return manager.settings;
});

ipcMain.handle('save-settings', (_, settings: Partial<AppSettings>) => {
  return manager.saveSettings(settings);
});

ipcMain.handle('probe-url', async (_, { url, headers }) => {
  return manager.probe(url, headers);
});

ipcMain.handle('add-download', async (_, options: NewDownloadOptions) => {
  return manager.add(options);
});

ipcMain.handle('pause-download', async (_, id: string) => {
  return manager.pause(id);
});

ipcMain.handle('resume-download', async (_, id: string) => {
  return manager.resume(id);
});

ipcMain.handle('delete-download', async (_, { id, deleteFile }) => {
  return manager.remove(id, deleteFile);
});

ipcMain.handle('pause-all', async () => {
  return manager.pauseAll();
});

ipcMain.handle('resume-all', async () => {
  return manager.resumeAll();
});

ipcMain.handle('open-file', async (_, filePath: string) => {
  await shell.openPath(filePath);
});

ipcMain.handle('show-in-folder', async (_, filePath: string) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle('select-directory', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
