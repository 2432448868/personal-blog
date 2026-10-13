import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(projectRoot, 'node_modules', 'mermaid', 'dist');
const sourceEntry = path.join(sourceRoot, 'mermaid.esm.min.mjs');
const sourceChunks = path.join(sourceRoot, 'chunks', 'mermaid.esm.min');
const targetRoot = path.join(projectRoot, 'public', 'vendor', 'mermaid');

if (!existsSync(sourceEntry) || !existsSync(sourceChunks)) {
  throw new Error('mermaid dist files are missing; run npm install first');
}

const publicRoot = path.join(projectRoot, 'public') + path.sep;
const resolvedTarget = path.resolve(targetRoot) + path.sep;
if (!resolvedTarget.startsWith(publicRoot)) {
  throw new Error(`refuse to write outside public/: ${resolvedTarget}`);
}

rmSync(targetRoot, { recursive: true, force: true });
mkdirSync(path.join(targetRoot, 'chunks', 'mermaid.esm.min'), { recursive: true });
cpSync(sourceEntry, path.join(targetRoot, 'mermaid.esm.min.mjs'));
cpSync(sourceChunks, path.join(targetRoot, 'chunks', 'mermaid.esm.min'), { recursive: true });

console.log(`[mermaid] synced browser assets -> ${path.relative(projectRoot, targetRoot)}`);