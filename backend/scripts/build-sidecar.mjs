import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..');
const binariesDir = path.join(backendRoot, '..', 'src-tauri', 'binaries');
const ext = process.platform === 'win32' ? '.exe' : '';
const stagingName = `job-tracker-api-staging${ext}`;
const stagingPath = path.join(backendRoot, stagingName);

if (fs.existsSync(stagingPath)) {
  fs.unlinkSync(stagingPath);
}

console.log('Building sidecar with caxa...');
execSync(
  `npx caxa --input . --output "${stagingPath}" -- "node" "{{caxa}}/server.js"`,
  {
    cwd: backendRoot,
    stdio: 'inherit',
  },
);

const targetTriple = execSync('rustc --print host-tuple').toString().trim();
if (!targetTriple) {
  throw new Error('Failed to determine platform target triple');
}

fs.mkdirSync(binariesDir, { recursive: true });

const finalName = `job-tracker-api-${targetTriple}${ext}`;
const finalPath = path.join(binariesDir, finalName);

if (fs.existsSync(finalPath)) {
  fs.unlinkSync(finalPath);
}

fs.renameSync(stagingPath, finalPath);
console.log(`Sidecar ready: ${finalPath}`);
