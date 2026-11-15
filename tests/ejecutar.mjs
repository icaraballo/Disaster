// Lanza todos los tests (npm test).
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const ficheros = readdirSync(dir).filter(f => f.endsWith('.test.mjs')).map(f => path.join(dir, f));
const hijo = spawn(process.execPath, ['--test', ...ficheros], { stdio: 'inherit' });
hijo.on('exit', (code) => process.exit(code ?? 1));
