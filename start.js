/**
 * Wavelet Retail AI - Unified Application Launcher
 * Spawns ML Service (FastAPI) and Backend Server (Express + Dashboard) concurrently
 */

const { spawn } = require('child_process');
const path = require('path');

const rootDir = __dirname;
const mlDir = path.join(rootDir, 'ml-service');
const serverDir = path.join(rootDir, 'server');

console.log('================================================================');
console.log('  🚀 Launching Wavelet Retail AI Demand Forecasting Platform');
console.log('================================================================');

// 1. Spawn ML Service (FastAPI on Port 8000)
console.log('[Launcher] Starting ML Service (Port 8000)...');
const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
const mlProcess = spawn(pythonCmd, ['main.py'], {
  cwd: mlDir,
  shell: true,
  stdio: 'inherit'
});

mlProcess.on('error', (err) => {
  console.error('[Launcher] Failed to start ML Service:', err.message);
});

// Wait 2.5 seconds before launching server so ML models start loading
setTimeout(() => {
  // 2. Spawn Express Server (Port 5000, serves Dashboard + API)
  console.log('[Launcher] Starting Express Server & Dashboard (Port 5000)...');
  const serverProcess = spawn('node', ['src/index.js'], {
    cwd: serverDir,
    shell: true,
    stdio: 'inherit'
  });

  serverProcess.on('error', (err) => {
    console.error('[Launcher] Failed to start Express Server:', err.message);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[Launcher] Stopping all services...');
    try { mlProcess.kill(); } catch (e) {}
    try { serverProcess.kill(); } catch (e) {}
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}, 2500);
