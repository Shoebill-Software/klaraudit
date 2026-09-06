import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'src', 'reporters', 'templates');
const to = join(root, 'dist', 'reporters', 'templates');

mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true });
