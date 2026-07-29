import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';

const root = dirname(fileURLToPath(import.meta.url));
const firstPort = 8765;
const lastPort = 8775;
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function resolveRequestPath(url) {
  const pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = normalize(join(root, relativePath));
  if (filePath !== root && !filePath.startsWith(root + sep)) return null;
  return filePath;
}

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  try {
    let filePath = resolveRequestPath(request.url);
    if (!filePath) throw Object.assign(new Error('Forbidden'), { code: 'EACCES' });
    if ((await stat(filePath)).isDirectory()) filePath = join(filePath, 'index.html');
    const body = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache'
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    const statusCode = error.code === 'ENOENT' ? 404 : error.code === 'EACCES' ? 403 : 500;
    response.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(statusCode === 404 ? 'Not Found' : statusCode === 403 ? 'Forbidden' : 'Server Error');
  }
});

function openBrowser(url) {
  const child = spawn('cmd.exe', ['/c', 'start', '', url], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  child.unref();
}

function getLanAddresses() {
  const virtualAdapter = /vmware|virtual|vethernet|loopback|zerotier|docker|wsl/i;
  const wirelessAdapter = /wi-?fi|wlan|无线|wireless/i;
  return Object.entries(networkInterfaces())
    .flatMap(([name, addresses]) => (addresses || [])
      .filter(address => address.family === 'IPv4' && !address.internal)
      .map(address => ({ name, address: address.address })))
    .sort((left, right) => {
      const score = item => (wirelessAdapter.test(item.name) ? 0 : virtualAdapter.test(item.name) ? 2 : 1);
      return score(left) - score(right);
    });
}

function listen(port) {
  server.once('error', error => {
    if (error.code === 'EADDRINUSE' && port < lastPort) {
      listen(port + 1);
      return;
    }
    console.error(`启动失败：${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, '0.0.0.0', () => {
    const localUrl = `http://127.0.0.1:${port}/`;
    console.log(`本机访问：${localUrl}`);
    console.log('');
    console.log('手机 Safari 访问（手机和电脑需连接同一 Wi-Fi）：');
    for (const [index, item] of getLanAddresses().entries()) {
      console.log(`  ${index === 0 ? '推荐' : item.name}: http://${item.address}:${port}/`);
    }
    console.log('');
    console.log('questions.json 会在每次刷新页面时自动同步。');
    console.log('关闭本窗口即可停止服务。');
    if (process.env.QUESTION_BANK_NO_BROWSER !== '1') openBrowser(localUrl);
  });
}

listen(firstPort);
