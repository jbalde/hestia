import { createServer, createConnection } from 'net';
import { spawn } from 'child_process';

const API_PORT = 3001;
const API_POLL_INTERVAL_MS = 1000;
const API_TIMEOUT_MS = 60_000;

function findPort(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(port, () => {
      server.close(() => resolve(port));
    });
    server.on('error', () => resolve(findPort(port + 1)));
  });
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = createConnection(port, '127.0.0.1');
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });
}

async function waitForApi() {
  const start = Date.now();
  process.stdout.write(`Esperando al API en puerto ${API_PORT}...`);
  while (Date.now() - start < API_TIMEOUT_MS) {
    if (await isPortOpen(API_PORT)) {
      process.stdout.write(' listo.\n');
      return;
    }
    await new Promise((r) => setTimeout(r, API_POLL_INTERVAL_MS));
    process.stdout.write('.');
  }
  process.stdout.write('\n');
  console.warn(`El API no respondió en ${API_TIMEOUT_MS / 1000}s, arrancando web igualmente.`);
}

await waitForApi();

const port = await findPort(3000);
if (port !== 3000) {
  console.log(`Puerto 3000 ocupado, usando puerto ${port}`);
}

const proc = spawn('next', ['dev', '--port', String(port)], { stdio: 'inherit' });
proc.on('exit', (code) => process.exit(code ?? 0));
