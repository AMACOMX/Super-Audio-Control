import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generatedDirectories = ['dist', 'build', 'release', 'coverage'];

for (const directory of generatedDirectories) {
  rmSync(path.join(projectRoot, directory), { recursive: true, force: true });
}

console.log('Removed generated output: dist, build, release, coverage.');
