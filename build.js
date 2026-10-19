const esbuild = require('esbuild');
const path = require('path');

const isWatch = process.argv.includes('--watch');

const commonConfig = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  external: ['electron', 'ws'],
};

async function build() {
  const mainContext = await esbuild.context({
    ...commonConfig,
    entryPoints: [path.resolve(__dirname, 'src/main/main.ts')],
    outfile: path.resolve(__dirname, 'dist/main/main.js'),
  });

  const preloadContext = await esbuild.context({
    ...commonConfig,
    entryPoints: [path.resolve(__dirname, 'src/preload/preload.ts')],
    outfile: path.resolve(__dirname, 'dist/preload/preload.js'),
  });

  const serverContext = await esbuild.context({
    ...commonConfig,
    entryPoints: [path.resolve(__dirname, 'src/main/server.ts')],
    outfile: path.resolve(__dirname, 'dist/main/server.js'),
  });

  const downloaderContext = await esbuild.context({
    ...commonConfig,
    entryPoints: [path.resolve(__dirname, 'src/main/engine/Downloader.ts')],
    outfile: path.resolve(__dirname, 'dist/main/engine/Downloader.js'),
  });

  if (isWatch) {
    await Promise.all([
      mainContext.watch(),
      preloadContext.watch(),
      serverContext.watch(),
      downloaderContext.watch(),
    ]);
    console.log('[esbuild] Watching for changes in main, preload, server, and engine...');
  } else {
    await Promise.all([
      mainContext.rebuild(),
      preloadContext.rebuild(),
      serverContext.rebuild(),
      downloaderContext.rebuild(),
    ]);
    await Promise.all([
      mainContext.dispose(),
      preloadContext.dispose(),
      serverContext.dispose(),
      downloaderContext.dispose(),
    ]);
    console.log('[esbuild] Build complete.');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
