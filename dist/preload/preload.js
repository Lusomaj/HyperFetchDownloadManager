"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/preload/preload.ts
var preload_exports = {};
module.exports = __toCommonJS(preload_exports);
var import_electron = require("electron");
var electronAPI = {
  getDownloads: () => import_electron.ipcRenderer.invoke("get-downloads"),
  getStats: () => import_electron.ipcRenderer.invoke("get-stats"),
  getSettings: () => import_electron.ipcRenderer.invoke("get-settings"),
  saveSettings: (settings) => import_electron.ipcRenderer.invoke("save-settings", settings),
  probeUrl: (url, headers) => import_electron.ipcRenderer.invoke("probe-url", { url, headers }),
  addDownload: (options) => import_electron.ipcRenderer.invoke("add-download", options),
  pauseDownload: (id) => import_electron.ipcRenderer.invoke("pause-download", id),
  resumeDownload: (id) => import_electron.ipcRenderer.invoke("resume-download", id),
  deleteDownload: (id, deleteFile) => import_electron.ipcRenderer.invoke("delete-download", { id, deleteFile }),
  pauseAll: () => import_electron.ipcRenderer.invoke("pause-all"),
  resumeAll: () => import_electron.ipcRenderer.invoke("resume-all"),
  openFile: (filePath) => import_electron.ipcRenderer.invoke("open-file", filePath),
  showInFolder: (filePath) => import_electron.ipcRenderer.invoke("show-in-folder", filePath),
  selectDirectory: () => import_electron.ipcRenderer.invoke("select-directory"),
  onDownloadProgress: (callback) => {
    const handler = (_, item) => callback(item);
    import_electron.ipcRenderer.on("download-progress", handler);
    return () => import_electron.ipcRenderer.removeListener("download-progress", handler);
  },
  onStateChange: (callback) => {
    const handler = (_, list) => callback(list);
    import_electron.ipcRenderer.on("state-change", handler);
    return () => import_electron.ipcRenderer.removeListener("state-change", handler);
  },
  onClipboardUrlDetected: (callback) => {
    const handler = (_, url) => callback(url);
    import_electron.ipcRenderer.on("clipboard-url", handler);
    return () => import_electron.ipcRenderer.removeListener("clipboard-url", handler);
  }
};
import_electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
//# sourceMappingURL=preload.js.map
