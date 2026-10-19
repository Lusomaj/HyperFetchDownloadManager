# HyperFetch - Internet Download Manager

An advanced multi-segmented download accelerator built with **Node.js, TypeScript, React, and Electron**, designed to replicate and modernize the core features of **Internet Download Manager (IDM)**.

---

## ✨ Features

- **Multi-Threaded Segmented Downloading**: Splits files into 1 to 32 concurrent HTTP range streams using RFC 7233.
- **Direct-to-Disk Sparse-File Writing**: Writes incoming byte buffers directly to file offsets, eliminating disk copying and merging delays at 100%.
- **Dynamic Sub-Segmentation**: Automatically splits lagging chunks among finished threads to maximize bandwidth saturation.
- **IDM Segment Visualizer**: Real-time visual timeline showing each connection thread, byte range allocation, and live throughput.
- **Smart URL Probing**: Automatically detects Content-Length, filename, MIME category, and server Range support.
- **File Organization**: Auto-sorts downloads into *Compressed*, *Documents*, *Music*, *Video*, and *Programs*.
- **Pause & Resume**: Safe state persistence in JSON for resuming interrupted downloads.
- **Dual Runtime**:
  - Run as a **Desktop Application** via Electron with Windows clipboard sniffing and system notifications.
  - Run as a **Web Service / Daemon** with WebSocket API for browser use and browser extensions.

---

## 🛠️ Project Structure

```
IDMProject/
├── src/
│   ├── main/
│   │   ├── engine/
│   │   │   ├── Downloader.ts       # Multi-connection HTTP range download engine
│   │   │   └── DownloadManager.ts  # Queue, state persistence, concurrency manager
│   │   ├── main.ts                 # Electron desktop process & IPC handlers
│   │   └── server.ts               # HTTP & WebSocket background daemon
│   ├── preload/
│   │   └── preload.ts              # Typed Electron context bridge
│   ├── shared/
│   │   └── types.ts                # Shared TypeScript models & interfaces
│   └── renderer/
│       ├── components/
│       │   ├── Toolbar.tsx         # IDM top action bar & speed meters
│       │   ├── Sidebar.tsx         # Categories & status filters
│       │   ├── DownloadList.tsx    # Live downloads table & actions
│       │   ├── SegmentModal.tsx    # Iconic IDM multi-thread segment visualizer
│       │   ├── AddDownloadModal.tsx# URL probe & download configuration dialog
│       │   └── SettingsModal.tsx   # Concurrency, speed limits, and directories
│       ├── api.ts                  # Universal API adapter (IPC + WebSockets)
│       ├── App.tsx                 # Main application controller
│       ├── index.css               # Vanilla CSS design system (Dark mode)
│       └── main.tsx                # React root entrypoint
├── package.json
├── vite.config.ts
├── tsconfig.json
└── build.js                        # Lightning-fast esbuild bundler
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Web Dashboard & Background Engine
```bash
npm run dev:web
```
- Open `http://localhost:5173/` in your browser.
- The background download engine runs on `http://localhost:38241`.

### 3. Run the Native Desktop App (Electron)
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```
