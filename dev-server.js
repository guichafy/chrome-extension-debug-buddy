const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const chokidar = require('chokidar');
const path = require('path');
const config = require('./webpack.config');

// Set environment to development
process.env.NODE_ENV = 'development';

// Create webpack compiler
const compiler = webpack(config);

// Create a variable to track if the initial build is complete
let isInitialBuildComplete = false;

// Function to notify Chrome extension to reload
const notifyExtensionToReload = () => {
  console.log('Changes detected, rebuilding...');

  // Create a timestamp file that the extension can check to know when to reload
  const fs = require('fs');
  const updateInfo = {
    timestamp: Date.now(),
    message: 'Extension should reload'
  };

  // Write to the dist directory so it's accessible to the extension
  fs.writeFileSync('./dist/last-update.json', JSON.stringify(updateInfo));
};

// Set up file watcher for extension reload
const watcher = chokidar.watch([
  'src/**/*.ts',
  'src/**/*.js',
  '*.html',
  'styles.css',
  'manifest.json',
  'images/**/*',
  'lib/**/*'
], {
  ignored: /(^|[/\\])\..|node_modules|dist/,
  persistent: true
});

// Listen for file changes
watcher.on('change', (path) => {
  if (isInitialBuildComplete) {
    console.log(`File ${path} has been changed`);
    notifyExtensionToReload();
  }
});

// Set up webpack compiler hooks
compiler.hooks.done.tap('DonePlugin', (stats) => {
  if (stats.hasErrors()) {
    console.log('Build failed with errors');
    return;
  }

  if (!isInitialBuildComplete) {
    isInitialBuildComplete = true;
    console.log('Initial build complete. Watching for changes...');
    console.log('');
    console.log('==========================================================');
    console.log('  Chrome Extension Hot Reload Development Server');
    console.log('==========================================================');
    console.log('');
    console.log('  1. Open Chrome and go to chrome://extensions');
    console.log('  2. Enable "Developer mode"');
    console.log('  3. Click "Load unpacked" and select the "dist" folder');
    console.log('  4. Any changes to the source files will trigger a rebuild');
    console.log('     and the extension will be reloaded automatically');
    console.log('');
    console.log('==========================================================');
  } else {
    console.log('Build successful. Extension should reload automatically.');
  }
});

// Run webpack in watch mode
compiler.watch({
  aggregateTimeout: 300,
  poll: undefined
}, (err, stats) => {
  if (err) {
    console.error(err);
    return;
  }

  console.log(stats.toString({
    chunks: false,
    colors: true
  }));
});
