const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const electron = require('electron');

const VITE_URL = 'http://localhost:5173';
const MAIN_FILE = path.resolve(__dirname, 'dist/main/main.js');

function checkVite() {
  return new Promise((resolve) => {
    http.get(VITE_URL, (res) => {
      if (res.statusCode === 200 || res.statusCode === 304) {
        resolve(true);
      } else {
        resolve(false);
      }
    }).on('error', () => {
      resolve(false);
    });
  });
}

async function waitForReady() {
  console.log('[Launcher] Waiting for Vite server and Main build...');
  let attempts = 0;
  while (attempts < 60) {
    const isViteReady = await checkVite();
    const isMainReady = fs.existsSync(MAIN_FILE);

    if (isViteReady && isMainReady) {
      console.log('[Launcher] Vite server & Main process ready. Launching Electron...');
      const child = spawn(electron, ['.'], {
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'development' },
      });

      child.on('close', (code) => {
        process.exit(code || 0);
      });
      return;
    }

    await new Promise((r) => setTimeout(r, 500));
    attempts++;
  }

  console.error('[Launcher] Timed out waiting for Vite and Main to be ready.');
  process.exit(1);
}

waitForReady();
